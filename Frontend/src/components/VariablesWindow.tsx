import { useEffect, useRef, useState } from 'react';
import type { PythonValue, UserFunction } from '../../../Parser/Nodes';

interface VariablesWindowProps {
  variables: Record<string, PythonValue>;
  functionDefinitions?: Map<string, UserFunction>;
  scopeStack: Map<string, PythonValue>[];
  scopeNames: string[];
  mode: 'view' | 'predict';
  loopIterationState?: Map<string, number>;
  onVariableListMapping?: (variable: string, listName: string | null) => void;
  waitingForPrediction?: boolean;
  predictionVariable?: string;
  predictionCorrectValue?: PythonValue;
  onPredictionSubmit?: (variable: string, predictedValue: string) => void;
  predictionFeedback?: {
    variable: string;
    userValue: string;
    correctValue: PythonValue;
    isCorrect: boolean;
  } | null;
}

function VariablesWindow({
  variables,
  functionDefinitions,
  scopeStack,
  scopeNames,
  mode,
  loopIterationState,
  onVariableListMapping,
  waitingForPrediction,
  predictionVariable,
  predictionCorrectValue,
  onPredictionSubmit,
  predictionFeedback,
}: VariablesWindowProps) {
  const [predictionInput, setPredictionInput] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);
  const [variableListMappings, setVariableListMappings] = useState<Map<string, string>>(new Map());

  // gets all of the list variables.
  function getAllLists() {
    const lists: string[] = [];
    scopeStack.forEach(scope => {
      scope.forEach((value, name) => {
        if (Array.isArray(value) && !name.startsWith('__')) {
          lists.push(name);
        }
      });
    });
    return lists;
  };

  function handleListMapping(varName: string, listName: string) {
    const newMappings = new Map(variableListMappings);
    newMappings.set(varName, listName);
    setVariableListMappings(newMappings);
    onVariableListMapping?.(varName, listName);
  };

  useEffect(() => {
    if (waitingForPrediction && inputRef.current) {
      inputRef.current.focus();
    }
  }, [waitingForPrediction]);

  useEffect(() => {
    if (!waitingForPrediction) {
      setPredictionInput('');
    }
  }, [waitingForPrediction]);

  // separate variables into primitives (for Frames) and objects (for Objects)
  const frames: Record<string, PythonValue> = {};
  const objects: Array<{
    id: string; // unique identifier for each object
    value: PythonValue; // value of the object
    type: string; // type of the object
    name?: string; // name that is OPTIONAL because you can just declare something like a list literal.
  }> = [];
  const references: Record<string, string> = {}; // mapping from variable name to object id
  const listExists: boolean = getAllLists().length > 0

  let objectId = 0;

  // add functions from functionDefinitions
  if (functionDefinitions) {
    functionDefinitions.forEach((func, funcName) => {
      const id = `obj${objectId++}`; // new ID is incremented.
      objects.push({ id, value: func, type: 'function', name: funcName });
      references[funcName] = id; // add rellationship to references between variable name and ID.
    });
  }

  // add variables next
  Object.entries(variables).forEach(([name, value]) => {
    // handles arrays stored in variables.
    if (Array.isArray(value)) {
      const id = `obj${objectId++}`;
      objects.push({ id, value, type: 'list', name });
      references[name] = id;
      // if value is an object or some sort or a function
    } else if (
      value !== null &&
      typeof value === 'object' &&
      'type' in value &&
      value.type === 'Function'
    ) {
      // handle function objects in variables (if need be)
      const id = `obj${objectId++}`;
      objects.push({ id, value, type: 'function', name });
      references[name] = id;
    } else {
      // otherwise, just add regular variables to frames.
      frames[name] = value;
    }
  });

  // helper function similar to what we had before for formatting output.
  function formattedValue(value: PythonValue) {
    if (Array.isArray(value)) {
      return `[${value
        .map((v) =>
          typeof v === 'string'
            ? `'${v}'`
            : v === null
              ? 'None'
              : typeof v === 'boolean'
                ? v
                  ? 'True'
                  : 'False'
                : String(v),
        )
        .join(', ')}]`;
    }
    if (typeof value === 'string') {
      return `"${value}"`;
    }
    if (value === null) return 'None';
    if (typeof value === 'boolean') return value ? 'True' : 'False';
    return String(value);
  }

  // prevents submitting an empty prediction.
  const handlePredictionKeyPress = (
    e: React.KeyboardEvent<HTMLInputElement>,
  ) => {
    if (e.key === 'Enter' && predictionVariable && onPredictionSubmit) {
      if (!predictionInput || predictionInput.trim() === '') {
        e.preventDefault();
        return; // not submitting if empty.
      }

      // check if all inputs have values for lists.
      if (
        Array.isArray(predictionCorrectValue) &&
        !predictionVariable?.includes('[')
      ) {
        const inputs = document.querySelectorAll('[data-index]');
        const hasEmptyInput = Array.from(inputs).some(
          (input) => !input.value || input.value.trim() === '',
        );

        if (hasEmptyInput) {
          e.preventDefault();
          const firstEmpty = Array.from(inputs).find(
            (input) => !input.value || input.value.trim() === '',
          ) as HTMLInputElement;
          firstEmpty?.focus();
          return;
        }
      }

      onPredictionSubmit(predictionVariable, predictionInput);
    }
  };

  // show user feedback when submission is right or wrong.
  const renderFeedbackBadge = () => {
    if (!predictionFeedback) return null;

    return (
      <div
        className={`absolute top-2 right-2 px-3 py-2 rounded-lg flex items-center gap-2 z-10 ${predictionFeedback.isCorrect
          ? 'bg-green-500/20 border border-green-500'
          : 'bg-red-500/20 border border-red-500'
          }`}
      >
        {predictionFeedback.isCorrect ? (
          <>
            <span className="text-green-400 text-sm font-semibold">
              Correct!
            </span>
          </>
        ) : (
          <>
            <div className="text-red-400 text-sm">
              <div className="font-semibold">Incorrect</div>
              <div className="text-xs mt-1">
                Expected: {formattedValue(predictionFeedback.correctValue)}
              </div>
            </div>
          </>
        )}
      </div>
    );
  };

  return (
    <div className="flex flex-col h-full bg-[#1E1E1E] border border-gray-700 relative">
      {renderFeedbackBadge()}

      <div className="bg-[#2D2D2D] px-4 py-2 border-b border-gray-700 text-center text-white flex items-center justify-center gap-2">
        <span>Variables</span>
        {mode === 'predict' && (
          <span className="text-xs bg-purple-600 px-2 py-1 rounded">
            PREDICT MODE
          </span>
        )}
      </div>

      <div className="flex flex-1">
        {/* Frames */}
        <div className="flex-1 flex flex-col border-r border-gray-700">
          <div className="bg-[#2D2D2D] px-3 py-2 text-xs border-b border-gray-700 text-white">
            Frames
          </div>
          <div className="p-3 text-sm text-white overflow-auto space-y-3">
            {scopeStack.map((scope, index) => {
              const scopeName = scopeNames[index] || `Scope ${index}`;
              const isCurrentScope = index === scopeStack.length - 1;

              return (
                <div
                  key={index}
                  className={`border rounded p-2 ${isCurrentScope
                    ? 'border-purple-500 bg-purple-900/20'
                    : 'border-gray-600 bg-gray-800/30'
                    }`}
                >
                  <div className="text-xs text-gray-400 mb-2">
                    {scopeName} {isCurrentScope && '(current)'}
                  </div>

                  {scope.size === 0 ? (
                    <div className="text-xs text-gray-500">No variables</div>
                  ) : (
                    <div className="space-y-1">
                      {Array.from(scope.entries()).map(([name, value]) => {
                        if (name.startsWith('__')) return null;

                        if (Array.isArray(value)) return null;

                        const isWaitingForThis =
                          isCurrentScope &&
                          mode === 'predict' &&
                          waitingForPrediction &&
                          name === predictionVariable;

                        const isLoopVariable =
                          loopIterationState?.has(name) || false;

                        return (
                          <div
                            key={name}
                            className={`flex gap-2 items-center ${isWaitingForThis
                              ? 'bg-purple-900/30 p-2 rounded animate-pulse'
                              : ''
                              }`}
                          >
                            {/*{isLoopVariable && (
                              <span
                                className="text-orange-400 text-xs"
                                title="Loop variable"
                              >
                                iterator
                              </span>
                            )}*/}
                            <span
                              className={`${isLoopVariable ? 'text-orange-400' : 'text-blue-400'}`}
                            >
                              {name}
                            </span>
                            <span className="text-gray-500">:</span>
                            {isWaitingForThis ? (
                              <input
                                ref={inputRef}
                                type="text"
                                value={predictionInput}
                                onChange={(e) =>
                                  setPredictionInput(e.target.value)
                                }
                                onKeyPress={handlePredictionKeyPress}
                                placeholder="Predict value..."
                                className="bg-gray-700 text-white px-2 py-1 rounded border border-purple-500 focus:outline-none focus:border-purple-400 text-sm"
                              />
                            ) : (
                              <span className="text-green-400">
                                {formattedValue(value)}
                              </span>
                            )}
                            {listExists && (
                              <select
                                value={variableListMappings.get(name) || ''}
                                onChange={(e) => handleListMapping(name, e.target.value)}
                                className="ml-2 bg-gray-700 text-white text-xs px-1 py-0.5 rounded border border-gray-600"
                              >
                                <option value="">Link to list...</option>
                                {getAllLists().map(listName => (
                                  <option key={listName} value={listName}>{listName}</option>
                                ))}
                              </select>
                            )}

                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* Objects */}
        <div className="flex-1 flex flex-col">
          <div className="bg-[#2D2D2D] px-3 py-2 text-xs border-b border-gray-700 text-white">
            Objects
          </div>
          <div className="p-3 text-xs text-white overflow-auto">
            {/*no objects, tell user there are no objects*/}
            {objects.length === 0 ? (
              <div className="text-gray-500">No objects</div>
            ) : (
              <div className="space-y-3">
                {objects.map(({ id, value, type, name }) => {
                  // Check if this object is being predicted
                  const objectVarName = Object.entries(references).find(
                    ([name, objId]) => objId === id,
                  )?.[0];
                  const isWaitingForThis =
                    mode === 'predict' &&
                    waitingForPrediction &&
                    objectVarName === predictionVariable;

                  return (
                    <div
                      key={id}
                      className={`border-2 border-yellow-500 rounded p-2 bg-yellow-900/10 ${isWaitingForThis
                        ? 'ring-2 ring-purple-500 animate-pulse'
                        : ''
                        }`}
                    >
                      <div className="text-xs text-yellow-400 mb-2">
                        {type} {name && `(${name})`}
                      </div>
                      {type === 'list' ? (
                        <div className="space-y-2">
                          {isWaitingForThis &&
                            !predictionVariable?.includes('[') &&
                            Array.isArray(predictionCorrectValue) ? (
                            <div className="w-full p-2 bg-purple-900/30 rounded">
                              <div className="text-xs text-purple-300 mb-2">
                                Predict each list element for{' '}
                                <span className="text-blue-400">
                                  {predictionVariable}
                                </span>
                                :
                              </div>
                              <div className="flex gap-1 flex-wrap">
                                {predictionCorrectValue.map((_, idx) => (
                                  <div
                                    key={idx}
                                    className="flex flex-col items-center"
                                  >
                                    <div className="text-xs text-gray-400">
                                      {idx}
                                    </div>
                                    <input
                                      ref={idx === 0 ? inputRef : null}
                                      type="text"
                                      placeholder="?"
                                      data-index={idx}
                                      onChange={(e) => {
                                        const inputs =
                                          document.querySelectorAll(
                                            '[data-index]',
                                          );
                                        const values = Array.from(inputs).map(
                                          (input) => input.value,
                                        );
                                        setPredictionInput(values.join(', '));
                                      }}
                                      onKeyPress={handlePredictionKeyPress}
                                      className="w-10 h-10 bg-gray-700 text-white text-center border border-purple-500 focus:outline-none focus:border-purple-400 text-xs rounded"
                                    />
                                  </div>
                                ))}
                              </div>
                              <div className="text-xs text-gray-400 mt-2">
                                Press Enter after filling all values...
                              </div>
                            </div>
                          ) : (
                            /* show the normal list */
                            <div className="flex gap-1 flex-wrap max-w-full">
                              {Array.isArray(value) &&
                                value.map((item, idx) => {
                                  const mappedVars = Array.from(variableListMappings.entries())
                                    .filter(([varName, mappedList]) => {
                                      if (mappedList !== name) return false;
                                      const varValue = scopeStack[scopeStack.length - 1].get(varName);
                                      // only check if variable equals this index
                                      return varValue === idx;
                                    })
                                    .map(([varName]) => varName);
                                  const indexVars = mappedVars;
                                  const valueVars: string[] = [];
                                  // check if predicting at a certain index.
                                  const isPredictingIndex =
                                    mode === 'predict' &&
                                    waitingForPrediction &&
                                    predictionVariable?.includes('[') &&
                                    objectVarName &&
                                    predictionVariable.startsWith(
                                      objectVarName + '[',
                                    ) &&
                                    (() => {
                                      // extract the index from predictionVariable
                                      const match =
                                        predictionVariable.match(/\[(\d+)\]/);
                                      if (match) {
                                        const predictedIdx = parseInt(
                                          match[1],
                                          10,
                                        );
                                        return predictedIdx === idx;
                                      }
                                      return false;
                                    })();

                                  const loopVarPointingHere =
                                    loopIterationState && objectVarName
                                      ? Array.from(loopIterationState.entries()).find(
                                        ([varName, iterationIndex]) => {
                                          const currentValue =
                                            scopeStack[scopeStack.length - 1].get(varName);

                                          if (currentValue === item) {
                                            const iterationCount = (iterationIndex || 1) - 1;

                                            if (
                                              iterationCount === idx &&
                                              value[iterationCount] === item
                                            ) {
                                              return true;
                                            }
                                          }

                                          return false;
                                        },
                                      )?.[0]
                                      : null;
                                  return (
                                    <div
                                      key={idx}
                                      className="flex flex-col items-center"
                                    >
                                      <div className="text-xs text-gray-400 flex items-center gap-1">
                                        <span>{idx}</span>
                                        {indexVars.length > 0 && (
                                          <span className="text-blue-400 font-semibold">
                                            ({indexVars.join(', ')})
                                          </span>
                                        )}
                                      </div>
                                      <div
                                        className={`w-10 h-10 border border-yellow-500 bg-yellow-500/10 flex items-center justify-center text-xs ${isPredictingIndex
                                          ? 'ring-2 ring-purple-500'
                                          : ''
                                          } ${loopVarPointingHere
                                            ? 'ring-2 ring-orange-400'
                                            : ''
                                          } ${mappedVars.length > 0
                                            ? 'ring-2 ring-blue-400'
                                            : ''
                                          }`}
                                      >
                                        {isPredictingIndex ? (
                                          <input
                                            ref={inputRef}
                                            type="text"
                                            value={predictionInput}
                                            onChange={(e) =>
                                              setPredictionInput(e.target.value)
                                            }
                                            onKeyPress={
                                              handlePredictionKeyPress
                                            }
                                            className="w-full h-full bg-gray-700 text-white text-center border-none focus:outline-none text-xs"
                                          />
                                        ) : item === null ? (
                                          'None'
                                        ) : typeof item === 'boolean' ? (
                                          item ? (
                                            'True'
                                          ) : (
                                            'False'
                                          )
                                        ) : typeof item === 'string' ? (
                                          `'${item}'`
                                        ) : (
                                          String(item)
                                        )}
                                      </div>
                                      {/*loop variables that are auto tracked*/}
                                      {loopVarPointingHere && (
                                        <div className="text-xs text-orange-400 font-semibold mt-1 flex items-center gap-0.5">
                                          <span>{loopVarPointingHere}</span>
                                        </div>
                                      )}
                                      {/*{mappedVars.length > 0 && !loopVarPointingHere && (
                                        <div className="text-xs text-blue-400 font-semibold mt-1">
                                          {mappedVars.join(', ')}
                                        </div>
                                      )}*/}
                                      {/*manually bound variables*/}
                                      {!loopVarPointingHere && valueVars.length > 0 && (
                                        <div className="text-xs text-blue-400 font-semibold mt-1">
                                          {valueVars.join(', ')}
                                        </div>
                                      )}
                                    </div>
                                  );
                                })}
                            </div>
                          )}
                        </div>
                      ) : type === 'function' ? (
                        <div className="text-sm">
                          <div className="text-blue-400">
                            function {value.name}(
                            {value.params?.join(', ') || ''})
                          </div>
                        </div>
                      ) : null}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export default VariablesWindow;
