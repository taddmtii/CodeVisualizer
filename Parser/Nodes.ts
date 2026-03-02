import * as moo from "moo";
import {
  Command,
  AssignVariableCommand,
  PushValueCommand,
  PopValueCommand,
  HighlightExpressionCommand,
  RetrieveValueCommand,
  HighlightStatementCommand,
  BinaryOpCommand,
  ComparisonOpCommand,
  UnaryOpCommand,
  ConditionalJumpCommand,
  JumpCommand,
  PrintCommand,
  LenCommand,
  TypeCommand,
  InputCommand,
  IndexAccessCommand,
  CreateListCommand,
  ReturnCommand,
  BreakCommand,
  ContinueCommand,
  ListSliceCommand,
  PushLoopBoundsCommand,
  PopLoopBoundsCommand,
  AppendCommand,
  CountCommand,
  PopCommand,
  SortCommand,
  RemoveCommand,
  IndexCommand,
  ReverseCommand,
  ContainsCommand,
  CallUserFunctionCommand,
  RangeCommand,
  IntCommand,
  FloatCommand,
  StrCommand,
  BoolCommand,
  ListCommand,
  DefineFunctionCommand,
  InterpolateFStringCommand,
} from "./Interpreter";

export type PythonValue =
  | number
  | string
  | PythonValue[]
  | Function
  | boolean
  | Object
  | null;
export type BinaryOp = "+" | "-" | "*" | "%" | "/" | "//" | "and" | "or" | "**";
export type ComparisonOp = "<" | ">" | "<=" | ">=" | "!=" | "==";
export type UnaryOp = "-" | "+" | "!" | "not";
export interface UserFunction {
  name: string;
  params: string[]; // names of the parameters
  body: Command[]; // commands that make up the function body
  type: "Function";
  startIndex: number; // where function starts in command array.
}

// ------------------------------------------------------------------
// ProgramNode
//
// Establishes list of statements that make up the program, encapsulates the
// entire program. All commands collectively get added here to returned array here.
// ------------------------------------------------------------------

export class ProgramNode {
  private _statementList: StatementNode[];
  constructor(_statementList: StatementNode[]) {
    this._statementList = _statementList;
  }

  execute(): Command[] {
    const commands: Command[] = [];
    for (const statement of this._statementList) {
      commands.push(...statement.execute());
    }
    return commands;
  }
}

// ------------------------------------------------------------------
// Statement Nodes
// ------------------------------------------------------------------

export abstract class StatementNode {
  abstract execute(): Command[];
  public _startTok: moo.Token;
  public _endTok: moo.Token;
  constructor(_tok: moo.Token) {
    this._startTok = _tok;
    this._endTok = _tok;
  }
  public get lineNum() {
    return this._startTok.line;
  }
  public get startLine() {
    return this._startTok.line;
  }
  public get endLine() {
    return this._endTok.line || this._startTok.line;
  }
}

export class AssignmentStatementNode extends StatementNode {
  private _left: string | ListAccessExpressionNode;
  private _right: ExpressionNode;
  public _tok: moo.Token;
  private _operator: "=" | "+=" | "-=";
  constructor(
    _left: string | ListAccessExpressionNode,
    _right: ExpressionNode,
    _tok: moo.Token,
    _operator: "=" | "+=" | "-=",
  ) {
    super(_tok);
    this._left = _left;
    this._right = _right;
    this._tok = _tok;
    this._operator = _operator;
  }

  execute(): Command[] {
    const commands: Command[] = [];
    commands.push(new HighlightStatementCommand(this));
    if (this._left instanceof ListAccessExpressionNode) {
      commands.push(...this._left._list.evaluate());
      commands.push(...this._left._index.evaluate());
      commands.push(...this._right.evaluate());
      commands.push(new AssignVariableCommand(this._left, this._operator));
      return commands;
    } else {
      commands.push(...this._right.evaluate());
      commands.push(
        new AssignVariableCommand(this._left as string, this._operator),
      );
      if (this._right instanceof FuncCallExpressionNode) {
        return commands;
      }
      return commands;
    }
  }
}

export class MultiAssignmentStatementNode extends StatementNode {
  private _identifiers: string[];
  private _expressions: ExpressionNode[];
  public _tok: moo.Token;

  constructor(
    _identifiers: string[],
    _expressions: ExpressionNode[],
    _tok: moo.Token,
  ) {
    super(_tok);
    this._identifiers = _identifiers;
    this._expressions = _expressions;
    this._tok = _tok;
  }

  execute(): Command[] {
    const commands: Command[] = [];
    commands.push(new HighlightStatementCommand(this));

    if (this._identifiers.length !== this._expressions.length) {
      throw new Error(
        `Cannot unpack ${this._expressions.length} values to ${this._identifiers.length} variables`,
      );
    }

    for (let i = this._expressions.length - 1; i >= 0; i--) {
      commands.push(...this._expressions[i].evaluate());
    }

    for (let i = 0; i <= this._identifiers.length - 1; i++) {
      commands.push(new AssignVariableCommand(this._identifiers[i]));
    }

    return commands;
  }
}

export class ReturnStatementNode extends StatementNode {
  private _value: ExpressionNode | null;
  constructor(
    _value: ExpressionNode,
    _tok: moo.Token,
  ) {
    super(_tok);
    this._value = _value;
  }
  execute(): Command[] {
    const commands: Command[] = [];

    commands.push(new HighlightStatementCommand(this));
    if (this._value) {
      commands.push(...this._value.evaluate());
    } else {
      commands.push(new PushValueCommand(null));
    }
    commands.push(new ReturnCommand());
    return commands;
  }
}

export class BreakStatementNode extends StatementNode {
  public _tok: moo.Token;
  constructor(_tok: moo.Token) {
    super(_tok);
    this._tok = _tok;
  }
  execute(): Command[] {
    const commands: Command[] = [];
    commands.push(new HighlightStatementCommand(this));
    commands.push(new BreakCommand());
    return commands;
  }
}

export class ContinueStatementNode extends StatementNode {
  private _tok: moo.Token;
  constructor(_tok: moo.Token) {
    super(_tok);
    this._tok = _tok;
  }
  execute(): Command[] {
    const commands: Command[] = [];
    commands.push(new HighlightStatementCommand(this));
    commands.push(new ContinueCommand());
    return commands;
  }
}

export class PassStatementNode extends StatementNode {
  private _tok: moo.Token;
  constructor(_tok: moo.Token) {
    super(_tok);
    this._tok = _tok;
  }
  execute(): Command[] {
    const commands: Command[] = [];
    commands.push(new HighlightStatementCommand(this));
    return commands;
  }
}

export class IfStatementNode extends StatementNode {
  private _condition: ExpressionNode;
  private _thenBranch: BlockStatementNode;
  private _elseBranch: BlockStatementNode | null;
  constructor(
    _condition: ExpressionNode,
    _thenBranch: BlockStatementNode,
    _elseBranch: BlockStatementNode | null,
    _tok: moo.Token,
  ) {
    super(_tok);
    this._condition = _condition;
    this._thenBranch = _thenBranch;
    this._elseBranch = _elseBranch;
  }
  execute(): Command[] {
    const commands: Command[] = [];
    commands.push(new HighlightStatementCommand(this));

    let conditionCommands: Command[] = this._condition.evaluate();
    commands.push(...conditionCommands);

    let thenCommands: Command[] = this._thenBranch.execute();
    let elseCommands: Command[] = [];
    if (this._elseBranch) {
      elseCommands = this._elseBranch.execute();
    }
    if (elseCommands.length > 0) {
      // has an else
      commands.push(new ConditionalJumpCommand(thenCommands.length + 3));
    } else {
      // no else: just jump over the then branch
      commands.push(new ConditionalJumpCommand(thenCommands.length + 2));
    }

    commands.push(...thenCommands);

    if (elseCommands.length > 0) {
      // has an else
      commands.push(new JumpCommand(elseCommands.length + 2));
      commands.push(...elseCommands);
    }

    return commands;
  }
}

export class ElifStatementNode extends StatementNode {
  private _condition: ExpressionNode;
  private _thenBranch: BlockStatementNode | null;
  private _elseBranch: BlockStatementNode | null;
  constructor(
    _condition: ExpressionNode,
    _thenBranch: BlockStatementNode,
    _elseBranch: BlockStatementNode,
    _tok: moo.Token,
  ) {
    super(_tok);
    this._condition = _condition;
    this._thenBranch = _thenBranch;
    this._elseBranch = _elseBranch;
  }
  execute(): Command[] {
    const commands: Command[] = [];
    commands.push(new HighlightStatementCommand(this));

    let conditionCommands: Command[] = this._condition.evaluate();
    commands.push(...conditionCommands);

    let thenCommands: Command[] = this._thenBranch!.execute();
    let elseCommands: Command[] = [];

    if (this._elseBranch) {
      elseCommands = this._elseBranch.execute();
    }

    if (elseCommands.length > 0) {
      // has more elif/else
      commands.push(new ConditionalJumpCommand(thenCommands.length + 3));
    } else {
      // no more elif/else
      commands.push(new ConditionalJumpCommand(thenCommands.length + 1));
    }

    commands.push(...thenCommands);

    if (elseCommands.length > 0) {
      commands.push(new JumpCommand(elseCommands.length + 2));
      commands.push(...elseCommands);
    }

    return commands;
  }
}

export class ForStatementNode extends StatementNode {
  private _loopVar: IdentifierExpressionNode;
  private _iterable: ExpressionNode;
  private _block: BlockStatementNode;
  constructor(
    _loopVar: IdentifierExpressionNode,
    _iterable: ExpressionNode,
    _block: BlockStatementNode,
    _tok: moo.Token,
  ) {
    super(_tok);
    this._loopVar = _loopVar;
    this._iterable = _iterable;
    this._block = _block;
  }
  execute(): Command[] {
    const commands: Command[] = [];
    commands.push(new HighlightStatementCommand(this));
    let iterableCommands: Command[] = this._iterable.evaluate();
    commands.push(...iterableCommands);

    const blockCommands = this._block.execute();
    commands.push(new PushLoopBoundsCommand(1, 4 + blockCommands.length, this._loopVar._tok.text));
    commands.push(new AssignVariableCommand(this._loopVar._tok.text));
    commands.push(new ConditionalJumpCommand(blockCommands.length + 3));
    commands.push(...blockCommands);
    commands.push(new JumpCommand(-(blockCommands.length + 2)));
    commands.push(new PopValueCommand());
    commands.push(new PopLoopBoundsCommand());
    return commands;
  }
}

export class WhileStatementNode extends StatementNode {
  private _expression: ExpressionNode;
  private _block: BlockStatementNode;
  constructor(
    _expression: ExpressionNode,
    _block: BlockStatementNode,
    _tok: moo.Token,
  ) {
    super(_tok);
    this._expression = _expression;
    this._block = _block;
  }
  execute(): Command[] {
    const commands: Command[] = [];
    commands.push(new HighlightStatementCommand(this));
    const blockCommands = this._block.execute();
    const conditionCommands = this._expression.evaluate();

    commands.push(
      new PushLoopBoundsCommand(
        1,
        blockCommands.length + conditionCommands.length + 2,
        ""
      ),
    );

    commands.push(...conditionCommands);
    commands.push(new ConditionalJumpCommand(blockCommands.length + 3));
    commands.push(...blockCommands);
    commands.push(
      new JumpCommand(-(blockCommands.length + conditionCommands.length + 1)),
    );

    commands.push(new PopLoopBoundsCommand());
    return commands;
  }
}

export class FuncDefStatementNode extends StatementNode {
  private _name: IdentifierExpressionNode;
  private _formalParamList: FormalParamsListExpressionNode | null;
  private _block: BlockStatementNode;

  constructor(
    _name: IdentifierExpressionNode,
    _formalParamList: FormalParamsListExpressionNode,
    _block: BlockStatementNode,
    _tok: moo.Token,
  ) {
    super(_tok);
    this._name = _name;
    this._formalParamList = _formalParamList;
    this._block = _block;
  }

  execute(): Command[] {
    const commands: Command[] = [];
    commands.push(new HighlightStatementCommand(this));

    const paramNames: string[] = [];
    if (this._formalParamList && this._formalParamList._paramsList) {
      for (const param of this._formalParamList._paramsList) {
        paramNames.push(param._tok.text);
      }
    }
    const blockCommands = this._block.execute();

    const functionObj: UserFunction = {
      name: this._name._tok.text,
      params: paramNames,
      body: blockCommands,
      type: "Function",
      startIndex: -1,
    };

    commands.push(new DefineFunctionCommand(functionObj));
    commands.push(new JumpCommand(blockCommands.length + 4));
    commands.push(...blockCommands);
    commands.push(new PushValueCommand(null));
    commands.push(new ReturnCommand());

    return commands;
  }
}

export class ExpressionStatementNode extends StatementNode {
  private _expression: ExpressionNode;
  constructor(_expression: ExpressionNode, _tok: moo.Token) {
    super(_tok);
    this._expression = _expression;
  }
  execute(): Command[] {
    const subCommands: Command[] = [];
    subCommands.push(new HighlightStatementCommand(this));
    subCommands.push(...this._expression.evaluate());
    if (this._expression instanceof FuncCallExpressionNode) {
      const funcName = this._expression._func_name;
      if (funcName instanceof IdentifierExpressionNode) {
        const name = funcName._tok.text;
        const builtIns = [
          "print",
          "len",
          "type",
          "input",
          "range",
          "int",
          "float",
          "str",
          "bool",
          "list",
        ];
        if (!builtIns.includes(name)) {
          subCommands.push(new PopValueCommand());
        }
      }
    }
    return subCommands
  }
}

export class BlockStatementNode extends StatementNode {
  private _statementList: StatementNode[];
  constructor(_statementList: StatementNode[], _tok: moo.Token) {
    super(_tok);
    this._statementList = _statementList;
  }
  execute(): Command[] {
    const commands: Command[] = [];

    if (this._statementList.length > 0) {
      commands.push(new HighlightStatementCommand(this));
    }

    for (let i = 0; i < this._statementList.length; i++) {
      const statement = this._statementList[i];
      if (statement === null) {
        continue;
      }
      commands.push(...statement.execute());
    }
    return commands;
  }
}

// ------------------------------------------------------------------
// Expression Nodes
// ------------------------------------------------------------------

export abstract class ExpressionNode {
  public _tok: moo.Token;
  constructor(_tok: moo.Token) {
    this._tok = _tok;
  }
  abstract evaluate(): Command[];
  public get lineNum() {
    return this._tok.line;
  }
  public get startLine() {
    return this._tok.line;
  }
  public get endLine() {
    return this._tok.line;
  }
  public get startCol() {
    return this._tok.col;
  }
  public get endCol() {
    return this._tok.col + (this._tok.text.length - 1);
  }
}

export class NumberLiteralExpressionNode extends ExpressionNode {
  private _value: string;
  constructor(value: string, tok: moo.Token) {
    super(tok);
    this._value = value;
  }

  evaluate(): Command[] {
    const commands: Command[] = [];

    let numValue: number;
    if (this._value.startsWith("0x")) {
      numValue = parseInt(this._value, 16);
    } else if (this._value.startsWith("0b")) {
      numValue = parseInt(this._value.slice(2), 2);
    } else if (this._value.includes(".")) {
      numValue = parseFloat(this._value);
    } else {
      numValue = Number(this._value);
    }
    commands.push(new HighlightExpressionCommand(this));
    commands.push(new PushValueCommand(numValue));
    return commands
  }
}

export class IdentifierExpressionNode extends ExpressionNode {
  public _tok: moo.Token;
  constructor(_tok: moo.Token) {
    super(_tok);
    this._tok = _tok;
  }
  evaluate(): Command[] {
    const commands: Command[] = [];
    commands.push(new HighlightExpressionCommand(this))
    commands.push(new RetrieveValueCommand(this._tok.text))
    return commands
  }
}

export class FormalParamsListExpressionNode extends ExpressionNode {
  public _paramsList: IdentifierExpressionNode[];
  constructor(_paramsList: IdentifierExpressionNode[]) {
    if (
      _paramsList === null ||
      _paramsList === undefined ||
      _paramsList.length === 0
    ) {
      const dummy = {
        line: 0,
        col: 0,
        text: "",
        type: "",
        value: "",
      } as moo.Token;
      super(dummy);
      this._paramsList = [];
    } else {
      super(_paramsList[0]._tok);
      this._paramsList = _paramsList;
    }
  }
  evaluate(): Command[] {
    const commands: Command[] = [];
    for (const param of this._paramsList) {
      commands.push(...param.evaluate());
    }
    return commands;
  }
}

export class ConditionalExpressionNode extends ExpressionNode {
  private _left: ExpressionNode;
  private _condition: ExpressionNode;
  private _right: ExpressionNode;
  constructor(
    _left: ExpressionNode,
    _condition: ExpressionNode,
    _right: ExpressionNode,
  ) {
    super(_condition._tok);
    this._left = _left;
    this._condition = _condition;
    this._right = _right;
  }
  evaluate(): Command[] {
    const commands: Command[] = [];
    commands.push(...this._condition.evaluate());
    commands.push(...this._left.evaluate());
    commands.push(...this._right.evaluate());
    return commands;
  }
}

export class ArgListExpressionNode extends ExpressionNode {
  private _argsList: ExpressionNode[];
  constructor(_argsList: ExpressionNode[]) {
    if (
      _argsList === null ||
      _argsList === undefined ||
      _argsList.length === 0
    ) {
      const dummy = {
        line: 0,
        col: 0,
        text: "",
        type: "",
        value: "",
      } as moo.Token;
      super(dummy);
      this._argsList = [];
    } else {
      super(_argsList[0]._tok);
      this._argsList = _argsList;
    }
  }

  get length(): number {
    return this._argsList.length;
  }

  get args(): ExpressionNode[] {
    return this._argsList;
  }

  evaluate(): Command[] {
    const commands: Command[] = [];
    for (const arg of this._argsList) {
      commands.push(...arg.evaluate());
    }
    return commands
  }
}

export class ComparisonExpressionNode extends ExpressionNode {
  private _left: ExpressionNode;
  private _operator: ComparisonOp;
  private _right: ExpressionNode;

  constructor(
    _left: ExpressionNode,
    _operator: ComparisonOp,
    _right: ExpressionNode,
  ) {
    super(_left._tok);
    this._left = _left;
    this._operator = _operator;
    this._right = _right;
  }
  evaluate(): Command[] {
    const commands: Command[] = [];
    commands.push(new HighlightExpressionCommand(this))
    commands.push(...this._left.evaluate())
    commands.push(...this._right.evaluate())
    commands.push(new ComparisonOpCommand(this._operator))
    return commands
  }
}

export class BinaryExpressionNode extends ExpressionNode {
  private _left: ExpressionNode;
  private _operator: BinaryOp;
  private _right: ExpressionNode;

  constructor(
    _left: ExpressionNode,
    _operator: BinaryOp,
    _right: ExpressionNode,
    _tok: moo.Token,
  ) {
    super(_tok);
    this._left = _left;
    this._operator = _operator;
    this._right = _right;
  }
  evaluate(): Command[] {
    const commands: Command[] = [];
    commands.push(new HighlightExpressionCommand(this));
    commands.push(...this._left.evaluate());
    commands.push(...this._right.evaluate());
    commands.push(new BinaryOpCommand(this._operator));
    return commands;
  }
}

export class UnaryExpressionNode extends ExpressionNode {
  private _operator: UnaryOp;
  private _operand: ExpressionNode;
  constructor(_operator: UnaryOp, _operand: ExpressionNode, _tok: moo.Token) {
    super(_tok);
    this._operator = _operator;
    this._operand = _operand;
  }
  evaluate(): Command[] {
    const commands: Command[] = [];
    commands.push(new HighlightExpressionCommand(this));
    commands.push(...this._operand.evaluate());
    commands.push(new UnaryOpCommand(this._operator));
    return commands;
  }
}

export class FuncCallExpressionNode extends ExpressionNode {
  public _func_name: ExpressionNode;
  private _args_list: ArgListExpressionNode;
  constructor(_func_name: ExpressionNode, _args_list: ArgListExpressionNode) {
    super(_func_name._tok);
    this._func_name = _func_name;
    this._args_list = _args_list;
  }
  evaluate(): Command[] {
    const commands: Command[] = [];
    commands.push(new HighlightExpressionCommand(this));
    if (this._args_list) {
      commands.push(...this._args_list.evaluate());
    }

    const numArgs = this._args_list ? this._args_list.length : 0;

    if (this._func_name instanceof IdentifierExpressionNode) {
      const funcName = this._func_name._tok.text;
      if (funcName === "print") {
        commands.push(new PrintCommand());
        return commands;
      } else if (funcName === "len") {
        commands.push(new LenCommand());
        return commands;
      } else if (funcName === "type") {
        commands.push(new TypeCommand());
        return commands;
      } else if (funcName === "input") {
        commands.push(new InputCommand());
        return commands;
      } else if (funcName === "range") {
        commands.push(new RangeCommand(numArgs));
        return commands;
      } else if (funcName === "int") {
        commands.push(new IntCommand());
        return commands;
      } else if (funcName === "float") {
        commands.push(new FloatCommand());
        return commands;
      } else if (funcName === "str") {
        commands.push(new StrCommand());
        return commands;
      } else if (funcName === "bool") {
        commands.push(new BoolCommand());
        return commands;
      } else if (funcName === "list") {
        commands.push(new ListCommand());
        return commands;
      } else {
        commands.push(new CallUserFunctionCommand(funcName, numArgs));
        return commands;
      }
    }
    return commands
  }
}

export class ListAccessExpressionNode extends ExpressionNode {
  public _list: IdentifierExpressionNode;
  public _index: ExpressionNode;
  constructor(_list: IdentifierExpressionNode, _index: ExpressionNode) {
    super(_list._tok);
    this._list = _list;
    this._index = _index;
  }
  evaluate(): Command[] {
    const commands: Command[] = [];
    commands.push(new HighlightExpressionCommand(this));
    commands.push(...this._list.evaluate());
    commands.push(...this._index.evaluate());
    commands.push(new IndexAccessCommand());
    return commands;
  }
}

export class MethodCallExpressionNode extends ExpressionNode {
  private _list: ExpressionNode;
  private _methodName: IdentifierExpressionNode;
  private _argsList: ArgListExpressionNode;
  constructor(
    _list: ExpressionNode,
    _methodName: IdentifierExpressionNode,
    _argsList: ArgListExpressionNode,
  ) {
    super(_list._tok);
    this._list = _list;
    this._methodName = _methodName;
    this._argsList = _argsList;
  }
  evaluate(): Command[] {
    const commands: Command[] = [];
    commands.push(new HighlightExpressionCommand(this));
    if (this._list) {
      commands.push(...this._list.evaluate());
    }
    if (this._argsList) {
      commands.push(...this._argsList.evaluate());
    }
    if (this._methodName instanceof IdentifierExpressionNode) {
      const methodName = this._methodName._tok.text;
      if (methodName === "append") {
        commands.push(new AppendCommand());
      } else if (methodName === "count") {
        commands.push(new CountCommand());
      } else if (methodName === "pop") {
        commands.push(new PopCommand());
      } else if (methodName === "remove") {
        commands.push(new RemoveCommand());
      } else if (methodName === "sort") {
        commands.push(new SortCommand());
      } else if (methodName === "index") {
        commands.push(new IndexCommand());
      } else if (methodName === "reverse") {
        commands.push(new ReverseCommand());
      } else if (methodName === "contains") {
        commands.push(new ContainsCommand());
      }
    }
    return commands;
  }
}

export class ListSliceExpressionNode extends ExpressionNode {
  private _list: ExpressionNode;
  private _start: ExpressionNode;
  private _stop: ExpressionNode;
  private _step: ExpressionNode;
  constructor(
    _list: ExpressionNode,
    _start: ExpressionNode,
    _stop: ExpressionNode,
    _step: ExpressionNode,
  ) {
    super(_list._tok);
    this._list = _list;
    this._start = _start;
    this._stop = _stop;
    this._step = _step;
  }
  evaluate(): Command[] {
    const commands: Command[] = [];
    commands.push(new HighlightExpressionCommand(this));
    commands.push(...this._list.evaluate());

    if (this._start) {
      commands.push(...this._start.evaluate());
    } else {
      commands.push(new PushValueCommand(null));
    }

    if (this._stop) {
      commands.push(...this._stop.evaluate());
    } else {
      commands.push(new PushValueCommand(null));
    }

    if (this._step) {
      commands.push(...this._step.evaluate());
    } else {
      commands.push(new PushValueCommand(null));
    }

    commands.push(new ListSliceCommand());
    return commands
  }
}

export class ListLiteralExpressionNode extends ExpressionNode {
  private _values: ArgListExpressionNode;
  constructor(_values: ArgListExpressionNode, _tok: moo.Token) {
    super(_tok);
    this._values = _values;
  }
  evaluate(): Command[] {
    const commands: Command[] = [];
    commands.push(new HighlightExpressionCommand(this));
    if (this._values) {
      commands.push(...this._values.evaluate());
    }
    let count = this._values ? this._values.length : 0;
    commands.push(new CreateListCommand(count));
    return commands
  }
}

export class BooleanLiteralExpressionNode extends ExpressionNode {
  private _value: boolean;
  constructor(_value: boolean, _tok: moo.Token) {
    super(_tok);
    this._value = Boolean(_value);
  }
  evaluate(): Command[] {
    const commands: Command[] = [];
    commands.push(new HighlightExpressionCommand(this))
    commands.push(new PushValueCommand(Boolean(this._value)))
    return commands
  }
}

export class StringLiteralExpressionNode extends ExpressionNode {
  private _value: moo.Token;
  constructor(_value: moo.Token) {
    super(_value);
    this._value = _value;
  }
  evaluate(): Command[] {
    let text = this._value.text;
    if (
      (text.startsWith('"') && text.endsWith('"')) ||
      (text.startsWith("'") && text.endsWith("'"))
    ) {
      text = text.slice(1, -1); // remove front quote and back quote to "clean" string
    }
    const commands: Command[] = [];
    commands.push(new HighlightExpressionCommand(this))
    commands.push(new PushValueCommand(text))
    return commands
  }
}

export class FStringLiteralExpressionNode extends ExpressionNode {
  private _value: moo.Token;
  constructor(_value: moo.Token) {
    super(_value);
    this._value = _value;
  }

  evaluate(): Command[] {
    const commands: Command[] = [];
    commands.push(new HighlightExpressionCommand(this));

    let text = this._value.text;
    if (
      (text.startsWith('"') && text.endsWith('"')) ||
      (text.startsWith("'") && text.endsWith("'"))
    ) {
      text = text.slice(1, -1);
    }
    // parse and replace {variable} with actual values
    commands.push(new InterpolateFStringCommand(text));

    return commands
  }
}
