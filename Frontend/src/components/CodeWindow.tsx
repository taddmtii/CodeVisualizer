import React, { useRef, useEffect } from 'react';
import Editor, { type Monaco } from '@monaco-editor/react';
import type { InterpreterError } from '../../../Parser/Errors';
import * as monaco from 'monaco-editor';

interface CodeWindowProps {
  code: string;
  onCodeChange: (code: string) => void;
  highlightedStatement: { startLine: number; endLine: number } | null;
  highlightedExpression: {
    line: number;
    startCol: number;
    endCol: number;
  } | null;
  // error: InterpreterError | null;
}

function CodeWindow({
  code,
  onCodeChange,
  highlightedStatement,
  highlightedExpression,
}: CodeWindowProps) {
  // holds the reference to the Monaco editor component itself.
  const editorRef = useRef<monaco.editor.IStandaloneCodeEditor | null>(null);

  // stores IDs of current text decorations so that we can later remove the highlight/add highlight.
  const decorationsRef = useRef<string[]>([]);

  const monacoRef = useRef<typeof import('monaco-editor')>(null);

  function onMount(editor: monaco.editor.IStandaloneCodeEditor) {
    // save editor instance so we can use it when we first mount.
    editorRef.current = editor;
  }

  // this useEffect is in charge of updating the highlights whenever they change (side effects)
  useEffect(() => {
    // if editor has not loaded yet do nothing.
    if (!editorRef.current) return;

    // create array to hold all the decoarations we want to implement.
    const decorations: monaco.editor.IModelDeltaDecoration[] = [];

    // STATEMENT HIGHLIGHTING IN YELLOW
    if (highlightedStatement) {
      // loops through each line in a statement (in case we have multi line statements.)
      for (
        let line = highlightedStatement.startLine;
        line <= highlightedStatement.endLine;
        line++
      ) {
        decorations.push({
          // monaco.range tells it what part of the code to actually highlight.
          // syntax: monaco.Range(startLine, startColumn, endLine, endColumn)
          range: new monaco.Range(
            line, // start at the line itself.
            1, // start at col 1 (which should be the beginning of the line)
            line, // end at the same line.
            Number.MAX_SAFE_INTEGER, // last possible column (not sure what to put here since its a statement.)
          ),
          options: {
            // isWholeLine: true,
            // className: "statement-highlight",
            inlineClassName: 'statement-highlight',
          },
        });
      }
    }

    // EXPRESSION HIGHLIGHTING IN BLUE
    if (highlightedExpression) {
      decorations.push({
        range: new monaco.Range(
          highlightedExpression.line,
          highlightedExpression.startCol,
          highlightedExpression.line,
          highlightedExpression.endCol + 1, // +1 because Monaco is inclusive (?)
        ),
        options: {
          inlineClassName: 'expression-highlight',
        },
      });
    }

    // now we actually apply these decorations. deltaDecorations removes old highlights using
    // the saved ids from the decoations array and then adds new highlights.
    // Returns new IDs to save for next time we call.

    decorationsRef.current = editorRef.current.deltaDecorations(
      decorationsRef.current, // old decorations to remove (why we needed the reference)
      decorations, // new decorations to add.
    );
  }, [highlightedStatement, highlightedExpression]); // whenever we highlight a statement or highlight an expression, call this.

  return (
    <div className="w-full h-full">
      {/*
        monaco unforundately needs global css classes, so tailwind is not available.
      */}
      <style>{`
        .statement-highlight {
          background-color: rgb(234 179 8 / 0.15) !important;
        }

        .expression-highlight {
          background-color: rgb(59 130 246 / 0.3) !important;
          border-bottom: 2px solid rgb(96 165 250) !important;
        }
      `}</style>

      {/* monaco editor component itself */}
      <Editor
        height="100%"
        defaultLanguage="python"
        value={code}
        onChange={(code) => onCodeChange((code as string) || '')}
        onMount={onMount}
        theme="vs-dark"
        options={{
          minimap: { enabled: false },
          fontSize: 16,
          lineNumbers: 'on',
          scrollBeyondLastLine: false,
        }}
      />
    </div>
  );
}

export default CodeWindow;
