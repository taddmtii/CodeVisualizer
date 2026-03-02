import {
  type PythonValue,
  type BinaryOp,
  type ComparisonOp,
  type UnaryOp,
  StatementNode,
  ExpressionNode,
  ListAccessExpressionNode,
  type UserFunction,
} from "./Nodes";

import {
  InterpreterError,
  RuntimeError,
  TypeError,
  NameError,
  IndexError,
  ZeroDivisionError,
} from "./Errors";

export abstract class Command {
  protected _undoCommand: Command | null = null;

  getUndoCommand(): Command | null {
    return this._undoCommand;
  }

  isVisible(): boolean {
    return true;
  }

  abstract do(_currentState: State): void;
  undo(_currentState: State) {
    this._undoCommand?.do(_currentState);
  }
}

export class State {
  private _programCounter: number = 0; // which line of execution are we on.
  private _currentExpression: ExpressionNode | null; // current highlighted expression we are evaluating
  private _currentStatement: StatementNode | null; // what statement are we on
  private _evaluationStack: PythonValue[]; // stack for expression evaluation
  private _loopStack: [number, number][];
  private _outputs: PythonValue[] = [];
  private _loopIterationState: Map<string, number> = new Map(); // tracks the iteration index per loop variable.
  private _error: InterpreterError | null = null;
  private _functionDefinitions: Map<string, UserFunction> = new Map();
  private _scopeStack: Map<string, PythonValue>[]; // stack of scopes
  private _scopeNames: string[]; // things like Global, "add" (function) etc...
  private _isPredictMode: boolean = false; // are we in predict mode?
  private _waitingForPrediction: boolean = false; // waiting for prediction
  private _predictionVariable: string | null = null; // which variable needs prediction
  private _predictionCorrectValue: PythonValue | null = null; // prediction correct value SHOULD be.
  private _functionCallStack: Array<{
    returnPC: number;
    functionName: string;
  }> = [];

  constructor(
    _programCounter: number,
    _currentExpression: ExpressionNode | null,
    _currentStatement: StatementNode | null,
    _evaluationStack: PythonValue[],
    _loopStack: [number, number][],
    _outputs: PythonValue[],
    _loopIterationState: Map<string, number>,
    _error: InterpreterError | null,
    _functionDefinitions: Map<string, UserFunction> = new Map(),
    _scopeStack = [new Map()],
    _scopeNames = ["Global"],
    _isPredictMode: boolean = false,
    _waitingForPrediction: boolean = false,
    _predictionVariable: string | null = null,
    _predictionCorrectValue: PythonValue | null = null,
    _functionCallStack: Array<{
      returnPC: number;
      functionName: string;
    }> = [],
  ) {
    this._programCounter = _programCounter;
    this._currentExpression = _currentExpression;
    this._currentStatement = _currentStatement;
    this._evaluationStack = _evaluationStack;
    this._loopStack = _loopStack;
    this._outputs = _outputs;
    this._loopIterationState = _loopIterationState;
    this._error = _error;
    this._functionDefinitions = _functionDefinitions;
    this._scopeStack = _scopeStack;
    this._scopeNames = _scopeNames;
    this._isPredictMode = _isPredictMode;
    this._waitingForPrediction = _waitingForPrediction;
    this._predictionVariable = _predictionVariable;
    this._predictionCorrectValue = _predictionCorrectValue;
    this._functionCallStack = _functionCallStack;
  }

  public get functionCallStack() {
    return this._functionCallStack;
  }

  public get isPredictMode() {
    return this._isPredictMode;
  }
  public set isPredictMode(val: boolean) {
    this._isPredictMode = val;
  }

  public get waitingForPrediction() {
    return this._waitingForPrediction;
  }
  public set waitingForPrediction(val: boolean) {
    this._waitingForPrediction = val;
  }

  public get predictionVariable() {
    return this._predictionVariable;
  }
  public set predictionVariable(val: string | null) {
    this._predictionVariable = val;
  }

  public get predictionCorrectValue() {
    return this._predictionCorrectValue;
  }
  public set predictionCorrectValue(val: PythonValue | null) {
    this._predictionCorrectValue = val;
  }

  public get scopeStack() {
    return this._scopeStack;
  }

  public get scopeNames() {
    return this._scopeNames;
  }

  public pushScope(name: string) {
    this._scopeStack.push(new Map());
    this._scopeNames.push(name);
  }

  public popScope() {
    if (this._scopeStack.length > 1) {
      this._scopeStack.pop();
    }
  }

  public get currentScope(): Map<string, PythonValue> {
    return this._scopeStack[this._scopeStack.length - 1];
  }

  public get functionDefinitions() {
    return this._functionDefinitions;
  }

  public setFunction(name: string, func: UserFunction) {
    this._functionDefinitions.set(name, func);
  }

  public getFunction(name: string): UserFunction | undefined {
    return this._functionDefinitions.get(name);
  }

  public get programCounter() {
    return this._programCounter;
  }
  public set programCounter(val: number) {
    this._programCounter = val;
  }

  public get outputs() {
    return this._outputs;
  }

  public get loopIterationState() {
    return this._loopIterationState;
  }

  public addOutput(value: PythonValue) {
    this._outputs.push(value);
  }

  public removeLastOutput() {
    this._outputs.pop();
  }

  public hasVariable(name: string): boolean {
    for (let i = this._scopeStack.length - 1; i >= 0; i--) {
      if (this._scopeStack[i].has(name)) {
        return true;
      }
    }
    return false;
  }

  public get currentExpression() {
    return this._currentExpression;
  }
  public set currentExpression(expr: ExpressionNode | null) {
    this._currentExpression = expr;
  }

  public get currentStatement() {
    return this._currentStatement;
  }
  public set currentStatement(stmt: StatementNode | null) {
    this._currentStatement = stmt;
  }

  public get evaluationStack() {
    return this._evaluationStack;
  }
  public get variables() {
    return this.currentScope;
  }

  public set variables(vars: Map<string, PythonValue | PythonValue[]>) {
    this._scopeStack[this._scopeStack.length - 1] = vars;
  }

  public get loopStack() {
    return this._loopStack;
  }

  public get error() {
    return this._error;
  }
  public set error(err: InterpreterError | null) {
    this._error = err;
  }

  public setVariable(name: string, value: PythonValue | PythonValue[]) {
    this.currentScope.set(name, value);
  }
  public getVariable(name: string): PythonValue | PythonValue[] {
    for (let i = this._scopeStack.length - 1; i >= 0; i--) {
      if (this._scopeStack[i].has(name)) {
        return this._scopeStack[i].get(name)!;
      }
    }
    return null;
  }

  public getCurrentStatementHighlight(): {
    startLine: number;
    endLine: number;
  } | null {
    if (!this._currentStatement) return null;
    return {
      startLine: this._currentStatement.startLine,
      endLine: this._currentStatement.endLine,
    };
  }

  public getCurrentExpressionHighlight(): {
    line: number;
    startCol: number;
    endCol: number;
  } | null {
    if (!this._currentExpression) return null;
    return {
      line: this._currentExpression.lineNum,
      startCol: this._currentExpression.startCol,
      endCol: this._currentExpression.endCol,
    };
  }
}

export class AssignVariableCommand extends Command {
  private _name: string | ListAccessExpressionNode;
  private _operator: "=" | "+=" | "-=";
  constructor(
    _name: string | ListAccessExpressionNode,
    _operator: "=" | "+=" | "-=" = "=",
  ) {
    super();
    this._name = _name;
    this._operator = _operator;
  }

  do(_currentState: State) {
    try {
      // List assignment
      if (typeof this._name !== "string") {
        const value = _currentState.evaluationStack.pop()!;
        const index = _currentState.evaluationStack.pop()!;
        const list = _currentState.evaluationStack.pop()!;

        if (value === undefined || index === undefined || list === undefined) {
          _currentState.error = new RuntimeError(
            `Stack underflow during list assignment (line ${_currentState.currentStatement?.startLine || "?"})`,
          );
        }

        if (typeof index !== "number") {
          _currentState.error = new TypeError(
            `list indices must be integers, not ${typeof index} (line ${_currentState.currentStatement?.startLine || "?"})`,
          );
        }

        if (!Array.isArray(list)) {
          _currentState.error = new TypeError(
            `'${typeof list}' object does not support item assignment (line ${_currentState.currentStatement?.startLine || "?"})`,
          );
        }

        let actualIndex = index;
        if (actualIndex < 0) {
          actualIndex = list.length + actualIndex;
        }

        if (actualIndex < 0 || actualIndex >= list.length) {
          _currentState.error = new IndexError(
            `list assignment index out of range (line ${_currentState.currentStatement?.startLine || "?"})`,
          );
        }
        const name = this._name;
        const oldValue = list[actualIndex];

        let finalValue = value;
        if (this._operator === "+=") {
          finalValue = (oldValue as number) + (value as number);
        } else if (this._operator === "-=") {
          finalValue = (oldValue as number) - (value as number);
        }

        list[actualIndex] = finalValue;

        this._undoCommand = new (class extends Command {
          do(state: State) {
            state.evaluationStack.push(list);
            state.evaluationStack.push(actualIndex);
            state.evaluationStack.push(oldValue);
            new AssignVariableCommand(name).do(state);
          }
        })();

        // CHECKING FOR PREDICTION ON LIST ASSIGNMENT
        // complete assignment first, then pause and ask user to predict was value was already assigned.
        if (_currentState.isPredictMode) {
          const varName = this._name._list._tok.text;
          _currentState.waitingForPrediction = true;
          _currentState.predictionVariable = `${varName}[${actualIndex}]`;
          _currentState.predictionCorrectValue = value;
          return;
        }

        return;
      }

      // For loop iteration
      const top = _currentState.evaluationStack[_currentState.evaluationStack.length - 1];

      if (_currentState.loopStack.length > 0 && Array.isArray(top)) {
        const iterable = _currentState.evaluationStack.pop()!;

        if (Array.isArray(iterable) && iterable.length > 0) {
          const currentIndex = _currentState.loopIterationState.get(this._name) || 0;

          if (currentIndex < iterable.length) {
            const nextItem = iterable[currentIndex];
            const oldValue = _currentState.getVariable(this._name);
            const hadVariable = _currentState.hasVariable(this._name);
            const oldIndex = currentIndex;
            const name = this._name;

            _currentState.setVariable(this._name, nextItem);
            _currentState.loopIterationState.set(this._name, currentIndex + 1);
            _currentState.evaluationStack.push(iterable);
            _currentState.evaluationStack.push(true);

            this._undoCommand = new (class extends Command {
              do(state: State) {
                state.evaluationStack.pop(); // pop true
                state.evaluationStack.pop(); // pop iterable

                if (oldIndex === 0 && !hadVariable) {
                  state.currentScope.delete(name);
                } else if (hadVariable) {
                  state.setVariable(name, oldValue);
                } else {
                  state.setVariable(name, iterable[oldIndex - 1]);
                }

                state.loopIterationState.set(name, oldIndex);
                state.evaluationStack.push(iterable);
              }
            })();

            // Prediction mode check
            if (_currentState.isPredictMode && typeof this._name === "string") {
              _currentState.waitingForPrediction = true;
              _currentState.predictionVariable = this._name;
              _currentState.predictionCorrectValue = nextItem;
              return;
            }
          } else {
            // Loop exhausted
            const name = this._name;
            const lastIndex = _currentState.loopIterationState.get(this._name) || 0;
            const lastValue = _currentState.getVariable(this._name);

            _currentState.evaluationStack.push(iterable);
            _currentState.evaluationStack.push(false);
            _currentState.loopIterationState.delete(this._name);

            this._undoCommand = new (class extends Command {
              do(state: State) {
                state.evaluationStack.pop(); // pop false
                state.evaluationStack.pop(); // pop iterable
                state.evaluationStack.push(iterable); // push iterable back
                state.loopIterationState.set(name, lastIndex);
                state.setVariable(name, lastValue);
              }
            })();
          }
        } else {
          // Empty iterable
          _currentState.evaluationStack.push(false);

          this._undoCommand = new (class extends Command {
            do(state: State) {
              state.evaluationStack.pop(); // pop false
              state.evaluationStack.push(iterable); // push iterable back
            }
          })();
        }
      } else {
        // Normal assignment
        const newValue = _currentState.evaluationStack.pop();

        if (newValue === undefined) {
          _currentState.error = new RuntimeError(
            `Stack underflow during variable assignment (line ${_currentState.currentStatement?.startLine || "?"})`,
          );
        }

        const oldValue = _currentState.getVariable(this._name);
        const hadVariable = _currentState.hasVariable(this._name);
        const name = this._name;

        let finalValue = newValue;
        if (this._operator === "+=") {
          if (!hadVariable) {
            _currentState.error = new NameError(
              `name '${this._name}' is not defined (line ${_currentState.currentStatement?.startLine || "?"})`,
            );
          }
          finalValue = (oldValue as number) + (newValue as number);
        } else if (this._operator === "-=") {
          if (!hadVariable) {
            _currentState.error = new NameError(
              `name '${this._name}' is not defined (line ${_currentState.currentStatement?.startLine || "?"})`,
            );
          }
          finalValue = (oldValue as number) - (newValue as number);
        }

        _currentState.setVariable(this._name, finalValue);

        this._undoCommand = new (class extends Command {
          do(state: State) {
            if (hadVariable) {
              state.setVariable(name, oldValue);
            } else {
              state.currentScope.delete(name);
            }
            state.evaluationStack.push(newValue);
          }
        })();

        // Prediction mode check
        if (_currentState.isPredictMode && typeof this._name === "string") {
          _currentState.waitingForPrediction = true;
          _currentState.predictionVariable = this._name;
          _currentState.predictionCorrectValue = newValue!;
          return;
        }
      }
    } catch (error) {
      if (error instanceof InterpreterError) {
        _currentState.error = error;
      }
      throw error;
    }
  }
}

export class PushValueCommand extends Command {
  private _value: PythonValue;
  constructor(value: PythonValue) {
    super();
    this._value = value;
  }

  isVisible(): boolean {
    return false;
  }

  do(_currentState: State) {
    _currentState.evaluationStack.push(this._value);
    this._undoCommand = new PopValueCommand();
  }
}

export class PushLoopBoundsCommand extends Command {
  private _start: number;
  private _end: number;
  constructor(_start: number, _end: number) {
    super();
    this._start = _start;
    this._end = _end;
  }

  isVisible(): boolean {
    return false;
  }

  do(_currentState: State) {
    let continueTarget = _currentState.programCounter + this._start;
    let breakTarget = _currentState.programCounter + this._end;
    _currentState.loopStack.push([continueTarget, breakTarget]);
    this._undoCommand = new PopLoopBoundsCommand();
  }
}

export class PopLoopBoundsCommand extends Command {
  constructor() {
    super();
  }

  isVisible(): boolean {
    return false;
  }

  do(_currentState: State) {
    const loopBound = _currentState.loopStack.pop()!;
    this._undoCommand = new PushLoopBoundsCommand(loopBound[0], loopBound[1]);
  }
}

export class BreakCommand extends Command {
  constructor() {
    super();
  }
  do(_currentState: State) {
    if (_currentState.loopStack.length === 0) {
      _currentState.error = new RuntimeError(
        `'break' outside loop (line ${_currentState.currentStatement?.startLine || "?"})`,
      );
    }
    const oldPC = _currentState.programCounter;
    let startStop: [number, number] =
      _currentState.loopStack[_currentState.loopStack.length - 1];
    _currentState.programCounter = startStop[1];

    this._undoCommand = new (class extends Command {
      do(state: State) {
        state.programCounter = oldPC;
      }
    })();
  }
}

export class ContinueCommand extends Command {
  constructor() {
    super();
  }
  do(_currentState: State) {
    if (_currentState.loopStack.length === 0) {
      _currentState.error = new RuntimeError(
        `'continue' not properly in loop (line ${_currentState.currentStatement?.startLine || "?"})`,
      );
    }
    const oldPC = _currentState.programCounter;
    let startStop: [number, number] =
      _currentState.loopStack[_currentState.loopStack.length - 1];
    _currentState.programCounter = startStop[0] - 1;

    this._undoCommand = new (class extends Command {
      do(state: State) {
        state.programCounter = oldPC;
      }
    })();
  }
}

// ConditionalJumpCommand -> jumps to line if condition in loop is true/false
// Used exclusively by if, while, for statements. only jumps if a conidtion (from the stack) evaluates to true/false.
// Example of use case:
// x > 5 gets evaluated, pushes True or False. ConditionalJumpCommand(2) would execute the next two commands, False would jump forward 2 commands.
export class ConditionalJumpCommand extends Command {
  private _commandsToJump: number;
  constructor(_commandsToJump: number) {
    super();
    this._commandsToJump = _commandsToJump;
  }

  isVisible(): boolean {
    return false;
  }

  do(_currentState: State) {
    const condition = _currentState.evaluationStack.pop()!;
    const boolCondition = Boolean(condition);

    if (condition === undefined) {
      _currentState.error = new RuntimeError(
        `Problem within conditional jump (condition evaluated to undefined) (line ${_currentState.currentStatement?.startLine || "?"})`,
      );
    }

    const oldPC = _currentState.programCounter;
    if (boolCondition === false) {
      _currentState.programCounter += this._commandsToJump - 1;
    }

    this._undoCommand = new (class extends Command {
      do(state: State) {
        state.programCounter = oldPC;
        state.evaluationStack.push(condition);
      }
    })();
  }
}

// JumpCommand -> jumps to a line number
// Used whenever want to always jump, end of loop is a great example.
// Use case:
// JumpCommand(2) -> skips two statements in block via skipping the commands themselves.
export class JumpCommand extends Command {
  private _commandsToJump: number;
  constructor(_commandsToJump: number) {
    super();
    this._commandsToJump = _commandsToJump;
  }

  isVisible(): boolean {
    return false;
  }

  do(_currentState: State) {
    const oldPC = _currentState.programCounter;
    _currentState.programCounter += this._commandsToJump - 1;

    this._undoCommand = new (class extends Command {
      do(state: State) {
        state.programCounter = oldPC;
      }
    })();
  }
}

export class PopValueCommand extends Command {
  isVisible(): boolean {
    return false;
  }

  do(_currentState: State) {
    let value: PythonValue;
    value = _currentState.evaluationStack.pop()!;
    this._undoCommand = new PushValueCommand(value);
    return value;
  }
}

export class HighlightExpressionCommand extends Command {
  private _expression: ExpressionNode;
  constructor(_expression: ExpressionNode) {
    super();
    this._expression = _expression;
  }

  do(_currentState: State) {
    const previousExpression = _currentState.currentExpression;
    this._undoCommand = new (class extends Command {
      do(state: State) {
        state.currentExpression = previousExpression;
      }
    })();

    _currentState.currentExpression = this._expression;
    const exprType = this._expression.constructor.name;
    const tok = this._expression._tok
      ? `"${this._expression._tok.text}" at line ${this._expression._tok.line}`
      : `at line ${this._expression.lineNum}`;
  }
}

export class RetrieveValueCommand extends Command {
  private _varName: string;
  constructor(_varName: string) {
    super();
    this._varName = _varName;
  }

  isVisible(): boolean {
    return false;
  }

  do(_currentState: State) {
    try {
      if (!_currentState.hasVariable(this._varName)) {
        _currentState.error = new NameError(
          `name '${this._varName}' is not defined (line ${_currentState.currentStatement?.startLine || "?"})`,
        );
      }
      const value = _currentState.getVariable(this._varName);
      this._undoCommand = new PopValueCommand();
      _currentState.evaluationStack.push(value);
    } catch (error) {
      if (error instanceof NameError) {
        _currentState.error = error;
      }
      throw error;
    }
  }
}

export class HighlightStatementCommand extends Command {
  private _statement: StatementNode;
  constructor(_statement: StatementNode) {
    super();
    this._statement = _statement;
  }
  do(_currentState: State) {
    const previousStatement = _currentState.currentStatement;
    this._undoCommand = new (class extends Command {
      do(state: State) {
        state.currentStatement = previousStatement;
      }
    })();
    _currentState.currentStatement = this._statement;
  }
}

// export class ReplaceHighlightedExpressionCommand extends Command {
//   private _oldExpression: ExpressionNode;
//   private _newExpression: ExpressionNode;
//   constructor(_oldExpression: ExpressionNode, _newExpression: ExpressionNode) {
//     super();
//     this._oldExpression = _oldExpression;
//     this._newExpression = _newExpression;
//   }
//   do(_currentState: State) {
//     this._undoCommand = new ReplaceHighlightedExpressionCommand(
//       this._newExpression,
//       this._oldExpression,
//     );
//     _currentState.currentExpression = this._newExpression;
//   }
// }

export class BinaryOpCommand extends Command {
  private _op: BinaryOp;
  constructor(_op: BinaryOp) {
    super();
    this._op = _op;
  }
  do(_currentState: State) {
    const evaluatedRight = _currentState.evaluationStack.pop()!;
    const evaluatedLeft = _currentState.evaluationStack.pop()!;
    let res: PythonValue = 0;

    if (
      this._op === "+" &&
      typeof evaluatedLeft === "string" &&
      typeof evaluatedRight === "string"
    ) {
      res = evaluatedLeft + evaluatedRight;
    } else if (this._op === "and") {
      res = evaluatedLeft && evaluatedRight;
    } else if (this._op === "or") {
      res = evaluatedLeft || evaluatedRight;
    } else if (
      typeof evaluatedLeft === "number" &&
      typeof evaluatedRight === "number"
    ) {
      switch (this._op) {
        case "+":
          res = evaluatedLeft + evaluatedRight;
          break;
        case "-":
          res = evaluatedLeft - evaluatedRight;
          break;
        case "%":
          if (evaluatedRight === 0) {
            _currentState.error = new ZeroDivisionError(
              `integer division or modulo by zero (line ${_currentState.currentStatement?.startLine || "?"})`,
            );
          }
          res = evaluatedLeft % evaluatedRight;
          break;
        case "*":
          res = evaluatedLeft * evaluatedRight;
          break;
        case "**":
          res = evaluatedLeft ** evaluatedRight;
          break;
        case "/":
          if (evaluatedRight === 0) {
            _currentState.error = new ZeroDivisionError(
              `integer division or modulo by zero (line ${_currentState.currentStatement?.startLine || "?"})`,
            );
          }
          res = evaluatedLeft / evaluatedRight;
          break;
        case "//":
          if (evaluatedRight === 0) {
            _currentState.error = new ZeroDivisionError(
              `integer division or modulo by zero (line ${_currentState.currentStatement?.startLine || "?"})`,
            );
          }
          res = Math.floor(evaluatedLeft / evaluatedRight);
          break;
      }
    }
    _currentState.evaluationStack.push(res);

    this._undoCommand = new (class extends Command {
      do(state: State) {
        state.evaluationStack.pop();
        state.evaluationStack.push(evaluatedLeft);
        state.evaluationStack.push(evaluatedRight);
      }
    })();
  }
}

export class ComparisonOpCommand extends Command {
  private _op: ComparisonOp;
  constructor(_op: ComparisonOp) {
    super();
    this._op = _op;
  }
  do(_currentState: State) {
    const evaluatedRight = _currentState.evaluationStack.pop()!;
    const evaluatedLeft = _currentState.evaluationStack.pop()!;
    let res: Boolean = false;

    switch (this._op.toString()) {
      case "<":
        res = evaluatedLeft < evaluatedRight;
        break;
      case ">":
        res = evaluatedLeft > evaluatedRight;
        break;
      case "<=":
        res = evaluatedLeft <= evaluatedRight;
        break;
      case ">=":
        res = evaluatedLeft >= evaluatedRight;
        break;
      case "!=":
        res = evaluatedLeft != evaluatedRight;
        break;
      case "==":
        res = evaluatedLeft === evaluatedRight;
        break;
      case "in":
        if (Array.isArray(evaluatedRight)) {
          res = evaluatedRight.includes(evaluatedLeft);
        } else if (typeof evaluatedRight === "string") {
          res = (evaluatedRight as string).includes(String(evaluatedLeft));
        } else {
          res = false;
        }
        break;
      default:
        res = false;
    }
    _currentState.evaluationStack.push(res);

    this._undoCommand = new (class extends Command {
      do(state: State) {
        state.evaluationStack.pop();
        state.evaluationStack.push(evaluatedLeft);
        state.evaluationStack.push(evaluatedRight);
      }
    })();
  }
}

export class UnaryOpCommand extends Command {
  private _operator: UnaryOp;
  constructor(_operator: UnaryOp) {
    super();
    this._operator = _operator;
  }
  do(_currentState: State) {
    let operand = _currentState.evaluationStack.pop()!;
    let res: PythonValue = 0;

    switch (this._operator) {
      case "-":
        if (typeof operand !== "number") {
          _currentState.error = new TypeError(
            `bad operand type for unary minus : '${typeof operand}' (line ${_currentState.currentStatement?.startLine || "?"})`,
          );
        }
        res = -operand;
        break;
      case "+":
        if (typeof operand !== "number") {
          _currentState.error = new TypeError(
            `bad operand type for unary plus : '${typeof operand}' (line ${_currentState.currentStatement?.startLine || "?"})`,
          );
        }
        res = operand;
        break;
      case "!":
        res = !operand;
        break;
      case "not":
        res = !operand;
        break;
    }
    _currentState.evaluationStack.push(res);

    this._undoCommand = new (class extends Command {
      do(state: State) {
        state.evaluationStack.pop();
        state.evaluationStack.push(operand);
      }
    })();
  }
}

export class AppendCommand extends Command {
  constructor() {
    super();
  }
  do(_currentState: State) {
    const argsList = _currentState.evaluationStack.pop()!;
    const list = _currentState.evaluationStack.pop()!;
    if (Array.isArray(list)) {
      if (argsList !== undefined) {
        list.push(argsList);
        this._undoCommand = new (class extends Command {
          do(state: State) {
            list.pop();
            state.evaluationStack.push(list);
            state.evaluationStack.push(argsList);
          }
        })();
      }
    }
  }
}

export class CountCommand extends Command {
  constructor() {
    super();
  }
  do(_currentState: State) {
    const argsList = _currentState.evaluationStack.pop()!;
    const list = _currentState.evaluationStack.pop()!;
    if (Array.isArray(list)) {
      if (argsList !== undefined) {
        const count = list.filter((elem) => elem === argsList).length;
        _currentState.evaluationStack.push(count);

        this._undoCommand = new (class extends Command {
          do(state: State) {
            state.evaluationStack.pop();
            state.evaluationStack.push(list);
            state.evaluationStack.push(argsList);
          }
        })();
      }
    }
  }
}

export class PopCommand extends Command {
  constructor() {
    super();
  }
  do(_currentState: State) {
    const list = _currentState.evaluationStack.pop()!;
    let poppedValue: PythonValue;
    if (Array.isArray(list)) {
      poppedValue = list.pop();

      _currentState.evaluationStack.push(poppedValue);
      this._undoCommand = new (class extends Command {
        do(state: State) {
          state.evaluationStack.pop();
          list.push(poppedValue);
          state.evaluationStack.push(list);
        }
      })();
    }
  }
}

export class SortCommand extends Command {
  constructor() {
    super();
  }
  do(_currentState: State) {
    const list = _currentState.evaluationStack.pop()!;
    if (Array.isArray(list)) {
      const originalOrder = [...list];
      list.sort();

      this._undoCommand = new (class extends Command {
        do(state: State) {
          list.length = 0;
          list.push(...originalOrder);
          state.evaluationStack.push(list);
        }
      })();
    }
  }
}

export class RemoveCommand extends Command {
  constructor() {
    super();
  }
  do(_currentState: State) {
    const argsList = _currentState.evaluationStack.pop()!;
    const list = _currentState.evaluationStack.pop()!;
    if (Array.isArray(list)) {
      if (argsList !== undefined) {
        const index = list.indexOf(argsList);
        if (index > -1) {
          list.splice(index, 1);
          this._undoCommand = new (class extends Command {
            do(state: State) {
              list.splice(index, 0, argsList);
              state.evaluationStack.push(list);
              state.evaluationStack.push(argsList);
            }
          })();
        }
      }
    }
  }
}

export class IndexCommand extends Command {
  constructor() {
    super();
  }
  do(_currentState: State) {
    const argsList = _currentState.evaluationStack.pop()!;
    const list = _currentState.evaluationStack.pop()!;
    if (Array.isArray(list)) {
      if (argsList !== undefined) {
        _currentState.evaluationStack.push(list.indexOf(argsList));
        this._undoCommand = new (class extends Command {
          do(state: State) {
            state.evaluationStack.pop();
            state.evaluationStack.push(list);
            state.evaluationStack.push(argsList);
          }
        })();
      }
    }
  }
}

export class ReverseCommand extends Command {
  constructor() {
    super();
  }
  do(_currentState: State) {
    const list = _currentState.evaluationStack.pop()!;
    if (Array.isArray(list)) {
      const originalOrder = [...list];
      _currentState.evaluationStack.push(list.reverse());
      this._undoCommand = new (class extends Command {
        do(state: State) {
          state.evaluationStack.pop();
          list.length = 0;
          list.push(...originalOrder);
          state.evaluationStack.push(list);
        }
      })();
    }
  }
}

export class ContainsCommand extends Command {
  constructor() {
    super();
  }
  do(_currentState: State) {
    const argsList = _currentState.evaluationStack.pop()!;
    const list = _currentState.evaluationStack.pop()!;
    if (Array.isArray(list)) {
      if (argsList !== undefined) {
        _currentState.evaluationStack.push(list.includes(argsList));
        this._undoCommand = new (class extends Command {
          do(state: State) {
            state.evaluationStack.pop();
            state.evaluationStack.push(list);
            state.evaluationStack.push(argsList);
          }
        })();
      }
    }
  }
}

export class PrintCommand extends Command {
  constructor() {
    super();
  }
  do(_currentState: State) {
    const value = _currentState.evaluationStack.pop()!;
    let output: string;
    if (typeof value === "string") {
      output = value;
    } else if (Array.isArray(value)) {
      output =
        "[" +
        value
          .map((v) => {
            if (typeof v === "string") return v;
            if (v === null) return "None";
            if (typeof v === "boolean") return v ? "True" : "False";
            return String(v);
          })
          .join(", ") +
        "]";
    } else if (value === null) {
      output = "None";
    } else if (typeof value === "boolean") {
      output = value ? "True" : "False";
    } else {
      output = String(value);
    }

    _currentState.addOutput(output);
    this._undoCommand = new (class extends Command {
      do(state: State) {
        state.removeLastOutput();
        state.evaluationStack.push(value);
      }
    })();
  }
}

export class LenCommand extends Command {
  constructor() {
    super();
  }
  do(_currentState: State) {
    const value = _currentState.evaluationStack.pop()!;
    if (typeof value === "string") {
      _currentState.evaluationStack.push(value.length);
    } else if (Array.isArray(value)) {
      _currentState.evaluationStack.push(value.length);
    }
    this._undoCommand = new (class extends Command {
      do(state: State) {
        state.evaluationStack.pop();
        state.evaluationStack.push(value);
      }
    })();
  }
}

export class TypeCommand extends Command {
  constructor() {
    super();
  }
  do(_currentState: State) {
    const value = _currentState.evaluationStack.pop()!;
    if (Array.isArray(value)) {
      _currentState.evaluationStack.push("<class 'list'>");
    } else if (typeof value === "number") {
      _currentState.evaluationStack.push("<class 'int'>");
    } else {
      _currentState.evaluationStack.push(typeof value);
    }
    this._undoCommand = new (class extends Command {
      do(state: State) {
        state.evaluationStack.pop();
        state.evaluationStack.push(value);
      }
    })();
  }
}

export class RangeCommand extends Command {
  private _numArgs: number;

  constructor(numArgs: number) {
    super();
    this._numArgs = numArgs;
  }

  do(_currentState: State) {
    let start = 0;
    let stop = 0;
    let step = 1;
    let args: PythonValue[] = [];

    if (this._numArgs === 1) {
      stop = Number(_currentState.evaluationStack.pop());
      args.push(stop);
    } else if (this._numArgs === 2) {
      const stopVal = _currentState.evaluationStack.pop();
      const startVal = _currentState.evaluationStack.pop();
      start = Number(startVal);
      stop = Number(stopVal);
      args.push(start);
      args.push(stop);
    } else if (this._numArgs === 3) {
      const stepVal = _currentState.evaluationStack.pop();
      const stopVal = _currentState.evaluationStack.pop();
      const startVal = _currentState.evaluationStack.pop();
      start = Number(startVal);
      stop = Number(stopVal);
      step = Number(stepVal);
      args.push(start);
      args.push(stop);
      args.push(step);
    }

    const result: number[] = [];
    if (step > 0) {
      for (let i = start; i < stop; i += step) {
        result.push(i);
      }
    } else if (step < 0) {
      for (let i = start; i > stop; i += step) {
        result.push(i);
      }
    }
    _currentState.evaluationStack.push(result);

    this._undoCommand = new (class extends Command {
      do(state: State) {
        state.evaluationStack.pop();
        for (let i = args.length - 1; i >= 0; i--) {
          state.evaluationStack.push(args[i]);
        }
      }
    })();
  }
}

export class InputCommand extends Command {
  constructor() {
    super();
  }
  do(_currentState: State) {
    const promptValue = _currentState.evaluationStack.pop()!;
    const promptMessage = String(promptValue);

    const userInput = prompt(promptMessage);

    const result = userInput !== null ? userInput : "";
    _currentState.evaluationStack.push(result);

    this._undoCommand = new (class extends Command {
      do(state: State) {
        state.evaluationStack.pop();
        state.evaluationStack.push(promptValue);
      }
    })();
  }
}

export class IndexAccessCommand extends Command {
  do(_currentState: State) {
    const index = _currentState.evaluationStack.pop();
    const list = _currentState.evaluationStack.pop();

    if (typeof index !== "number") {
      _currentState.error = new TypeError(
        `index must be a number (line ${_currentState.currentStatement?.startLine || "?"})`,
      );
    }

    let actualIndex = index;
    if (Array.isArray(list) || typeof list === "string") {
      if (actualIndex < 0) {
        actualIndex = list.length + actualIndex;
      }

      if (actualIndex < 0 || actualIndex >= list.length) {
        _currentState.error = new IndexError(
          `list index out of range (line ${_currentState.currentStatement?.startLine || "?"})`,
        );
      }

      _currentState.evaluationStack.push(list[actualIndex]);
      this._undoCommand = new (class extends Command {
        do(state: State) {
          state.evaluationStack.pop();
          state.evaluationStack.push(list);
          state.evaluationStack.push(index);
        }
      })();
    }
  }
}

export class ListSliceCommand extends Command {
  do(_currentState: State) {
    let step = _currentState.evaluationStack.pop();
    let end = _currentState.evaluationStack.pop();
    let start = _currentState.evaluationStack.pop();
    let list = _currentState.evaluationStack.pop();

    let startIndex = start === null ? 0 : Number(start);
    let stepIndex = step === null ? 1 : Number(step);

    if (Array.isArray(list)) {
      let endIndex: number;
      if (end === null) {
        endIndex = stepIndex > 0 ? list.length : -1;
      } else {
        endIndex = Number(end);
      }
      if (startIndex < 0) {
        startIndex = list.length + startIndex;
      }
      if (endIndex < 0 && endIndex !== null) {
        endIndex = list.length + endIndex;
      }
      let result: PythonValue[] = [];
      if (stepIndex > 0) {
        for (
          let i = startIndex;
          i < endIndex && i < list.length;
          i += stepIndex
        ) {
          result.push(list[i]);
        }
      } else if (stepIndex < 0) {
        for (let i = startIndex; i > endIndex && i >= 0; i += stepIndex) {
          result.push(list[i]);
        }
      }
      _currentState.evaluationStack.push(result);

      this._undoCommand = new (class extends Command {
        do(state: State) {
          state.evaluationStack.pop();
          state.evaluationStack.push(list);
          state.evaluationStack.push(start!);
          state.evaluationStack.push(end!);
          state.evaluationStack.push(step!);
        }
      })();
    } else if (typeof list === "string") {
      let result: string = "";
      let endIndex: number;
      if (end === null) {
        endIndex = stepIndex > 0 ? list.length : -1;
      } else {
        endIndex = Number(end);
      }

      if (startIndex < 0) {
        startIndex = list.length + startIndex;
      }
      if (endIndex < 0) {
        endIndex = list.length + endIndex;
      }
      if (stepIndex > 0) {
        for (
          let i = startIndex;
          i < endIndex && i < list.length;
          i += stepIndex
        ) {
          result += list[i];
        }
      } else if (stepIndex < 0) {
        for (let i = startIndex; i > endIndex && i >= 0; i += stepIndex) {
          result += list[i];
        }
      }
      _currentState.evaluationStack.push(result);
      this._undoCommand = new (class extends Command {
        do(state: State) {
          state.evaluationStack.pop();
          state.evaluationStack.push(list);
          state.evaluationStack.push(start!);
          state.evaluationStack.push(end!);
          state.evaluationStack.push(step!);
        }
      })();
    }
  }
}

export class CreateListCommand extends Command {
  private _count: number;

  constructor(_count: number) {
    super();
    this._count = _count;
  }

  do(_currentState: State) {
    const list: PythonValue[] = [];
    const poppedElements: PythonValue[] = [];
    for (let i = 0; i < this._count; i++) {
      const elem: PythonValue = _currentState.evaluationStack.pop()!;
      poppedElements.push(elem);
      list.unshift(elem);
    }

    _currentState.evaluationStack.push(list);
    this._undoCommand = new (class extends Command {
      do(state: State) {
        state.evaluationStack.pop();
        for (let i = poppedElements.length - 1; i >= 0; i--) {
          state.evaluationStack.push(poppedElements[i]);
        }
      }
    })();
  }
}

export class ReturnCommand extends Command {
  constructor() {
    super();
  }

  do(_currentState: State) {
    const value = _currentState.evaluationStack.pop() ?? null;
    const callInfo = _currentState.functionCallStack.pop();

    if (!callInfo) {
      _currentState.error = new RuntimeError(
        `'return' outside function (line ${_currentState.currentStatement?.startLine || "?"})`,
      );
      return;
    }

    _currentState.popScope();
    _currentState.scopeNames.pop();
    _currentState.programCounter = callInfo.returnPC + 1;
    _currentState.evaluationStack.push(value);

    this._undoCommand = new (class extends Command {
      do(state: State) {
        state.evaluationStack.pop();
        state.pushScope(callInfo.functionName);
        state.functionCallStack.push(callInfo);
        state.evaluationStack.push(value);
      }
    })();
  }
}

export class IntCommand extends Command {
  constructor() {
    super();
  }

  do(_currentState: State) {
    const value = _currentState.evaluationStack.pop()!;
    let result: number;

    if (typeof value === "number") {
      result = Math.trunc(value);
    } else if (typeof value === "string") {
      const parsed = parseInt(value, 10);
      result = parsed;
    } else if (typeof value === "boolean") {
      result = value ? 1 : 0;
    } else if (value === null) {
      console.error("argument for int() cannot be null");
      result = 0;
    } else {
      console.error("bad argument for int()");
      result = 0;
    }

    _currentState.evaluationStack.push(result);
    this._undoCommand = new (class extends Command {
      do(state: State) {
        state.evaluationStack.pop();
        state.evaluationStack.push(value);
      }
    })();
  }
}

export class FloatCommand extends Command {
  constructor() {
    super();
  }

  do(_currentState: State) {
    const value = _currentState.evaluationStack.pop()!;
    let result: number;

    if (typeof value === "number") {
      result = value;
    } else if (typeof value === "string") {
      const parsed = parseFloat(value);
      result = parsed;
    } else if (typeof value === "boolean") {
      result = value ? 1.0 : 0.0;
    } else {
      console.error(
        "argument for float() must be a number, string, or boolean.",
      );
      result = 0.0;
    }

    _currentState.evaluationStack.push(result);
    this._undoCommand = new (class extends Command {
      do(state: State) {
        state.evaluationStack.pop();
        state.evaluationStack.push(value);
      }
    })();
  }
}

export class StrCommand extends Command {
  constructor() {
    super();
  }

  do(_currentState: State) {
    const value = _currentState.evaluationStack.pop()!;
    let result: string;

    if (typeof value === "string") {
      result = value;
    } else if (typeof value === "number") {
      result = String(value);
    } else if (typeof value === "boolean") {
      result = value ? "True" : "False";
    } else if (value === null) {
      result = "None";
    } else if (Array.isArray(value)) {
      result =
        "[" +
        value
          .map((v) => {
            if (typeof v === "string") return `'${v}'`;
            if (v === null) return "None";
            if (typeof v === "boolean") return v ? "True" : "False";
            return String(v);
          })
          .join(", ") +
        "]";
    } else {
      result = String(value);
    }

    _currentState.evaluationStack.push(result);
    this._undoCommand = new (class extends Command {
      do(state: State) {
        state.evaluationStack.pop();
        state.evaluationStack.push(value);
      }
    })();
  }
}

export class BoolCommand extends Command {
  constructor() {
    super();
  }

  do(_currentState: State) {
    const value = _currentState.evaluationStack.pop()!;
    let result: boolean;

    if (value === null || value === false) {
      result = false;
    } else if (typeof value === "number") {
      result = value !== 0;
    } else if (typeof value === "string") {
      result = value.length > 0;
    } else if (Array.isArray(value)) {
      result = value.length > 0;
    } else if (typeof value === "boolean") {
      result = value;
    } else {
      result = true;
    }

    _currentState.evaluationStack.push(result);
    this._undoCommand = new (class extends Command {
      do(state: State) {
        state.evaluationStack.pop();
        state.evaluationStack.push(value);
      }
    })();
  }
}

export class ListCommand extends Command {
  constructor() {
    super();
  }

  do(_currentState: State) {
    const value = _currentState.evaluationStack.pop()!;
    let result: PythonValue[];

    if (Array.isArray(value)) {
      result = [...value];
    } else if (typeof value === "string") {
      result = value.split("");
    } else if (value === null) {
      result = [];
    } else {
      result = [];
    }

    _currentState.evaluationStack.push(result);
    this._undoCommand = new (class extends Command {
      do(state: State) {
        state.evaluationStack.pop();
        state.evaluationStack.push(value);
      }
    })();
  }
}

export class CallUserFunctionCommand extends Command {
  private _funcName: string;
  private _numArgs: number;

  constructor(funcName: string, numArgs: number) {
    super();
    this._funcName = funcName;
    this._numArgs = numArgs;
  }

  do(_currentState: State) {
    const func = _currentState.getFunction(this._funcName)!;
    if (!func) {
      _currentState.error = new NameError(
        `name '${this._funcName}' is not defined (line ${_currentState.currentStatement?.startLine || "?"})`,
      );
      return;
    }

    const args: PythonValue[] = [];
    for (let i = 0; i < this._numArgs; i++) {
      args.unshift(_currentState.evaluationStack.pop()!);
    }

    if (args.length !== func.params.length) {
      _currentState.error = new TypeError(
        `${this._funcName}() takes ${func.params.length} positional argument${func.params.length !== 1 ? "s" : ""} but ${args.length} ${args.length !== 1 ? "were" : "was"} given (line ${_currentState.currentStatement?.startLine || "?"})`,
      );
      return;
    }

    const returnPC = _currentState.programCounter;

    _currentState.pushScope(this._funcName);

    for (let i = 0; i < func.params.length; i++) {
      _currentState.setVariable(func.params[i], args[i]);
    }

    _currentState.functionCallStack.push({
      returnPC: returnPC,
      functionName: this._funcName,
    });

    _currentState.programCounter = func.startIndex - 1; // -1 because it will be incremented

    const numArgs = this._numArgs;
    this._undoCommand = new (class extends Command {
      do(state: State) {
        state.popScope();
        state.scopeNames.pop();
        state.functionCallStack.pop();
        state.programCounter = returnPC;

        for (let i = numArgs - 1; i >= 0; i--) {
          state.evaluationStack.push(args[i]);
        }
      }
    })();
  }
}

export class DefineFunctionCommand extends Command {
  private _functionObj: UserFunction;

  constructor(functionObj: UserFunction) {
    super();
    this._functionObj = functionObj;
  }

  do(_currentState: State) {
    this._functionObj.startIndex = _currentState.programCounter + 3;

    const hadFunction = _currentState.functionDefinitions.has(
      this._functionObj.name,
    );
    const oldFunction = _currentState.getFunction(this._functionObj.name);
    const funcObjectName = this._functionObj.name;

    _currentState.setFunction(this._functionObj.name, this._functionObj);

    this._undoCommand = new (class extends Command {
      do(state: State) {
        if (hadFunction) {
          state.setFunction(funcObjectName, oldFunction!);
        } else {
          state.functionDefinitions.delete(funcObjectName);
        }
      }
    })();
  }
}

export class InterpolateFStringCommand extends Command {
  private _template: string;

  constructor(template: string) {
    super();
    this._template = template;
  }

  do(_currentState: State) {
    const pattern = /\{([^}]+)\}/g;
    let result = this._template;
    const matches: string[] = [];
    let match;

    while ((match = pattern.exec(this._template)) !== null) {
      matches.push(match[1]);
    }

    for (const expr of matches) {
      const trimmed = expr.trim();
      let strValue: string;

      // simple variable reference (looking for identifiers), look it up.
      if (/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(trimmed)) {
        const value = _currentState.getVariable(trimmed);
        if (value === null && !_currentState.hasVariable(trimmed)) {
          _currentState.error = new NameError(
            `name '${trimmed}' is not defined (line ${_currentState.currentStatement?.startLine || "?"})`,
          );
          return;
        }
        strValue = this.formatValue(value);
      } else {
        // expression, simple or complex.
        try {
          // build context object with all variables. this will gather all the variables from all scopes into one object.
          const context: any = {};
          for (let i = _currentState.scopeStack.length - 1; i >= 0; i--) {
            _currentState.scopeStack[i].forEach((value, key) => {
              if (!(key in context)) {
                context[key] = value;
              }
            });
          }
          // create function that evaluates the expression in the context
          const evalFunc = new Function(...Object.keys(context), `return ${trimmed};`);
          const value = evalFunc(...Object.values(context));
          strValue = this.formatValue(value);
        } catch (error) {
          _currentState.error = new RuntimeError(
            `Invalid expression in f-string: ${trimmed} (line ${_currentState.currentStatement?.startLine || "?"})`,
          );
          return;
        }
      }

      result = result.replace(`{${expr}}`, strValue);
    }

    _currentState.evaluationStack.push(result);

    this._undoCommand = new (class extends Command {
      do(state: State) {
        state.evaluationStack.pop();
      }
    })();
  }
  // helper to assist in formatting value for string value that gets returned (within f string).
  private formatValue(value: PythonValue): string {
    if (typeof value === "string") {
      return value;
    } else if (Array.isArray(value)) {
      return (
        "[" +
        value
          .map((v) => {
            if (typeof v === "string") return `'${v}'`;
            if (v === null) return "None";
            if (typeof v === "boolean") return v ? "True" : "False";
            return String(v);
          })
          .join(", ") +
        "]"
      );
    } else if (value === null) {
      return "None";
    } else if (typeof value === "boolean") {
      return value ? "True" : "False";
    } else {
      return String(value);
    }
  }
}
