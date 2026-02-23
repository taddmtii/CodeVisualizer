import './App.css';
import Header from './components/Header';
import CodeWindow from './components/CodeWindow';
import ButtonControls from './components/ButtonControls';
import VariablesWindow from './components/VariablesWindow';
import OutputWindow from './components/OutputWindow';
import { useRef, useState } from 'react';
import { InterpreterService } from './services/InterpreterService';
import { type PythonValue, type UserFunction } from '../../Parser/Nodes';
import type { InterpreterError } from '../../Parser/Errors';

export interface SimplifiedState {
  variables: Record<string, PythonValue>;
  outputs: PythonValue[];
  canStepForward: boolean;
  canStepBackward: boolean;
  currentStep: number;
  totalSteps: number;
  highlightedStatement: { startLine: number; endLine: number } | null;
  highlightedExpression: {
    line: number;
    startCol: number;
    endCol: number;
  } | null;
  functionDefinitions: Map<string, UserFunction>;
  scopeStack: Map<string, PythonValue>[];
  scopeNames: string[];
  error: InterpreterError | null;
  parseError: string | null;
  loopIterationState: Map<string, number>;
  waitingForPrediction?: boolean;
  predictionVariable?: string;
  predictionCorrectValue?: PythonValue;
}

function App() {
  const [page, setPage] = useState<'view' | 'predict'>('view');
  const [code, setCode] = useState('');
  const [predictionFeedback, setPredictionFeedback] = useState<{
    variable: string; // variable that was predicted
    userValue: string; // predicted value
    correctValue: PythonValue; // correct value after reassignment
    isCorrect: boolean; // was it correct?
  } | null>(null);

  const [interpreterState, setInterpreterState] = useState<SimplifiedState>({
    variables: {},
    outputs: [],
    canStepForward: false,
    canStepBackward: false,
    currentStep: 0,
    totalSteps: 0,
    highlightedStatement: null,
    highlightedExpression: null,
    functionDefinitions: new Map<string, UserFunction>(),
    scopeNames: [],
    scopeStack: [],
    error: null,
    parseError: null,
    loopIterationState: new Map(),
  });

  // handles when we want to clear errors and restart execution.
  function handleReset() {
    const shouldBePredictMode = page === 'predict';

    interpreterServiceReference.current = new InterpreterService();
    interpreterServiceReference.current.setPredictMode(shouldBePredictMode);
    setInterpreterState({
      variables: {},
      outputs: [],
      canStepForward: false,
      canStepBackward: false,
      currentStep: 0,
      totalSteps: 0,
      highlightedStatement: null,
      highlightedExpression: null,
      functionDefinitions: new Map<string, UserFunction>(),
      scopeStack: [],
      scopeNames: [],
      error: null,
      parseError: null,
      loopIterationState: new Map(),
    });
  }

  const interpreterServiceReference = useRef(new InterpreterService());

  // set code state when code changes.
  function handleCodeChange(code: string) {
    setCode(code);
    setInterpreterState((prev) => ({
      ...prev,
      highlightedStatement: null,
      highlightedExpression: null,
    }));
  }

  function handleRun() {
    handleReset();
    const success = interpreterServiceReference.current.parseCode(code);

    if (!success) {
      const parseError = interpreterServiceReference.current.getParseError();
      setInterpreterState({
        ...interpreterState,
        parseError: parseError,
        canStepForward: false,
        currentStep: 0,
        totalSteps: 0,
      });
    } else {
      updateState();
    }
  }

  function handlePageChange(newPage: 'view' | 'predict') {
    setPage(newPage);
    handleReset();
    interpreterServiceReference.current.setPredictMode(newPage === 'predict');
  }

  // updates current state (snapshot) with what we have when we call the function.
  function updateState() {
    const state: SimplifiedState =
      interpreterServiceReference.current.getState();
    setInterpreterState(state);
  }

  function handleStepForward() {
    interpreterServiceReference.current.stepForward();
    updateState();
  }

  // handles the users prediction submission and compares it to the correct value. gives feedback and tells interpreter to then continue.
  function handlePredictionSubmit(variable: string, predictedValue: string) {
    const correctValue = interpreterState.predictionCorrectValue!;

    // parse the predicted value
    let parsedValue: PythonValue;

    // check if we're predicting a list (correct value is an array and no index in variable name)
    if (Array.isArray(correctValue) && !variable.includes('[')) {
      const trimmed = predictedValue.trim();
      if (trimmed.startsWith('[') && trimmed.endsWith(']')) {
        const content = trimmed.slice(1, -1);
        parsedValue = content.split(',').map((item) => {
          const cleaned = item.trim();
          if (cleaned === 'None') return null;
          if (cleaned === 'True') return true;
          if (cleaned === 'False') return false;
          if (!isNaN(Number(cleaned))) return Number(cleaned);
          return cleaned.replace(/["']/g, '');
        });
      } else {
        parsedValue = predictedValue.split(',').map((item) => {
          const cleaned = item.trim();
          if (cleaned === 'None') return null;
          if (cleaned === 'True') return true;
          if (cleaned === 'False') return false;
          if (!isNaN(Number(cleaned))) return Number(cleaned);
          return cleaned.replace(/["']/g, '');
        });
      }
    } else {
      if (predictedValue === 'None') parsedValue = null;
      else if (predictedValue === 'True') parsedValue = true;
      else if (predictedValue === 'False') parsedValue = false;
      else if (!isNaN(Number(predictedValue)))
        parsedValue = Number(predictedValue);
      else parsedValue = predictedValue.replace(/["']/g, '');
    }

    let isCorrect: boolean;
    if (Array.isArray(correctValue) && Array.isArray(parsedValue)) {
      isCorrect =
        correctValue.length === parsedValue.length &&
        correctValue.every((val, idx) => val === parsedValue[idx]);
    } else {
      isCorrect = parsedValue === correctValue;
    }

    setPredictionFeedback({
      variable,
      userValue: predictedValue,
      correctValue,
      isCorrect,
    });

    interpreterServiceReference.current.submitPrediction(
      variable,
      predictedValue,
    );

    updateState();

    setTimeout(() => setPredictionFeedback(null), 2000); // clears feedback after two seconds
  }

  function handleStepBackward() {
    interpreterServiceReference.current.stepBack();
    updateState();
  }

  function handleFirst() {
    interpreterServiceReference.current.toBeg();
    updateState();
  }

  function handleLast() {
    interpreterServiceReference.current.toEnd();
    updateState();
  }

  return (
    <>
      <Header page={page} setPage={handlePageChange} />
      <div className="bg-[#252525] border-x border-gray-700 p-3 text-center">
        <span className="text-white font-mono text-lg">
          Welcome to my Code Visualizer! You can start by typing code in the editor below.
        </span>
      </div>

      {interpreterState.parseError && (
        <div className="bg-red-900/30 border border-red-700 rounded p-3 mx-6 mt-2">
          <div className="flex items-center gap-2">
            <div>
              <div className="text-red-300 font-bold text-sm">Parse Error</div>
              <div className="text-red-200 text-xs mt-1">
                There was an error in parsing your code, please review syntax.
              </div>
            </div>
          </div>
        </div>
      )}

      <div className="flex p-6 gap-4">
        <div className="flex flex-col w-[60vw] h-[80vh] gap-2">
          <CodeWindow
            code={code}
            onCodeChange={handleCodeChange}
            highlightedStatement={interpreterState.highlightedStatement}
            highlightedExpression={interpreterState.highlightedExpression}
          />
          <ButtonControls
            onFirst={handleFirst}
            onPrev={handleStepBackward}
            onNext={handleStepForward}
            onLast={handleLast}
            onRun={handleRun}
            onReset={handleReset}
            canStepForward={
              interpreterState.canStepForward &&
              !interpreterState.waitingForPrediction
            }
            canStepBackward={
              interpreterState.canStepBackward &&
              !interpreterState.waitingForPrediction
            }
            hasError={!!interpreterState.error}
            disableFirstLast={page === 'predict'}
          />
        </div>

        <div className="flex flex-col w-[40vw] h-[85vh] gap-2">
          <div className="h-2/3">
            <VariablesWindow
              variables={interpreterState.variables}
              functionDefinitions={interpreterState.functionDefinitions}
              scopeStack={interpreterState.scopeStack}
              scopeNames={interpreterState.scopeNames}
              loopIterationState={interpreterState.loopIterationState}
              mode={page}
              waitingForPrediction={interpreterState.waitingForPrediction}
              predictionVariable={interpreterState.predictionVariable}
              predictionCorrectValue={interpreterState.predictionCorrectValue}
              onPredictionSubmit={handlePredictionSubmit}
              predictionFeedback={predictionFeedback}
            />
          </div>
          <div className="h-1/3">
            <OutputWindow
              outputs={interpreterState.outputs}
              error={interpreterState.error}
            />
          </div>
        </div>
      </div>
    </>
  );
}

export default App;
