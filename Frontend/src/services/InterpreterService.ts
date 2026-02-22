// const grammar = require("../../../Parser/grammar.js");
import { default as grammar } from '../../../Parser/grammar';
import nearley from 'nearley';
import { State, Command } from '../../../Parser/Interpreter';
import { ProgramNode } from '../../../Parser/Nodes';
import type { SimplifiedState } from '../App';

export class InterpreterService {
  private commands: Command[] = [];
  private state: State;
  private currentStep: number = 0;
  private parseErrorMessage: string | null = null;
  private executedCommands: number[] = [];
  private undoStack: Command[] = [];

  constructor() {
    this.state = new State(
      0, // programCounter
      null, // currentExpression
      null, // currentStatement
      [], // evaluationStack
      [], // loopStack
      [], // outputs
      new Map(), // loopIterationState
      null, // error
      new Map(), // functionDefinitions
      [new Map()], // scopeStack
      ['Global'], // scopeNames
      false, // isPredictMode
      false, // waitingForPrediction
      null, // predictionVariable
      null, // predictionCorrectValue
      [], // functionCallStack
    );
  }

  setPredictMode(enabled: boolean) {
    this.state.isPredictMode = enabled;
  }

  getParseError(): string | null {
    return this.parseErrorMessage;
  }

  parseCode(code: string): boolean {
    try {
      const savedPredictMode = this.state.isPredictMode;
      const parser = new nearley.Parser(nearley.Grammar.fromCompiled(grammar));
      parser.feed(code + '\n');

      if (parser.results.length === 0) {
        this.parseErrorMessage = 'Syntax Error: Could not parse code.';
        return false;
      }

      const program: ProgramNode = parser.results[0];
      this.commands = program.execute();
      this.currentStep = 0;
      this.executedCommands = [];
      this.undoStack = [];
      const globalScope = new Map();

      this.state = new State(
        0, // programCounter
        null, // currentExpression
        null, // currentStatement
        [], // evaluationStack
        [], // loopStack
        [], // outputs
        new Map(), // loopIterationState
        null, // error
        new Map(), // functionDefinitions
        [new Map()], // scopeStack
        ['Global'], // scopeNames
        savedPredictMode, // isPredictMode
        false, // waitingForPrediction
        null, // predictionVariable
        null, // predictionCorrectValue
        [], // functionCallStack
      );

      this.parseErrorMessage = null;
      return true;
    } catch (e) {
      console.log(e);

      if (e.token) {
        this.parseErrorMessage = `Syntax Error at line ${e.token.line}, column ${e.token.col}: Unexpected token "${e.token.text}"`;
      } else if (e.message) {
        this.parseErrorMessage = `Parse Error: ${e.message}`;
      } else {
        this.parseErrorMessage = 'Syntax Error: Could not parse code.';
      }

      return false;
    }
  }

  stepForward(): boolean {
    while (this.state.programCounter < this.commands.length && !this.state.error) {
      const pcBefore = this.state.programCounter;
      const command = this.commands[pcBefore];

      try {
        command.do(this.state);

        if (!this.state.waitingForPrediction) {
          this.executedCommands.push(pcBefore);
          this.undoStack.push(command.getUndoCommand());

          if (this.state.programCounter === pcBefore) {
            this.state.programCounter++;
          }
          this.currentStep++;

          if (command.isVisible()) {
            return true;
          }
        } else {
          return true;
        }
      } catch (error) {
        return false;
      }
    }
    return false
  }

  submitPrediction(variable: string, predictedValue: string): boolean {
    if (!this.state.waitingForPrediction) return false;

    this.state.waitingForPrediction = false;
    this.state.predictionVariable = null;
    this.state.predictionCorrectValue = null;

    this.state.programCounter++;
    this.currentStep++;

    return true;
  }

  stepBack(): boolean {
    while (this.currentStep > 0 && this.executedCommands.length > 0) {
      const commandPC = this.executedCommands.pop()!;
      const undoCommand = this.undoStack.pop()!;
      const command = this.commands[commandPC]

      if (undoCommand) {
        undoCommand.do(this.state);
      }

      this.state.programCounter = commandPC;
      this.currentStep--;

      if (command.isVisible()) {
        return true;
      }
    }
    return false
  }

  // returns a modified state snapshot that we can then send to the UI with only things is cares about.
  getState(): SimplifiedState {
    const result = {
      variables: Object.fromEntries(this.state.variables),
      outputs: [...this.state.outputs],
      canStepForward:
        this.state.programCounter < this.commands.length && !this.state.error,
      canStepBackward: this.currentStep > 0,
      currentStep: this.currentStep,
      totalSteps: this.commands.length,
      highlightedStatement: this.state.getCurrentStatementHighlight(),
      highlightedExpression: this.state.getCurrentExpressionHighlight(),
      functionDefinitions: this.state.functionDefinitions,
      scopeStack: [...this.state.scopeStack],
      scopeNames: [...this.state.scopeNames],
      error: this.state.error,
      parseError: this.parseErrorMessage,
      loopIterationState: this.state.loopIterationState,
      waitingForPrediction: this.state.waitingForPrediction,
      predictionVariable: this.state.predictionVariable,
      predictionCorrectValue: this.state.predictionCorrectValue,
    };
    return result;
  }

  toEnd(): void {
    while (this.stepForward()) {
      // empty
    }
  }

  toBeg(): void {
    while (this.stepBack()) {
      // empty
    }
  }
}
