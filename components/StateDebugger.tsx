// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025  Philipp Emanuel Weidmann <pew@worldwidemann.com>

import { IconButton, Text, Tooltip, VisuallyHidden } from "@radix-ui/themes";
import dynamic from "next/dynamic";
import { Dialog } from "radix-ui";
import { useState, useEffect, useRef } from "react";
import { GiAllSeeingEye, GiAcousticMegaphone, GiCancel, GiCardExchange, GiBigGear } from "react-icons/gi";
import { RxCross2, RxTriangleDown, RxTriangleRight } from "react-icons/rx";
import { useShallow } from "zustand/shallow";
import { type StoredState, useStateStore, getState } from "@/lib/state";
import { type IAppBackend } from "@/app/services/AppBackend";
import { generateActionsPrompt, type Prompt } from "@/lib/prompts";
import { Action } from "@/lib/schemas";
import * as z from "zod/v4";

// https://github.com/mac-s-g/react-json-view/issues/121#issuecomment-2578199942
const ReactJsonView = dynamic(() => import("@microlink/react-json-view"), { ssr: false });

export default function StateDebugger({ appBackend }: { appBackend: IAppBackend }) {
  // We need to manually open the dialog using a custom event handler,
  // because the Tooltip component is incompatible with Dialog.Trigger.
  const [dialogOpen, setDialogOpen] = useState(false);
  const [promptEditorExpanded, setPromptEditorExpanded] = useState(false);
  const [narrationPrompt, setNarrationPrompt] = useState("");
  const narrationReset = useRef("");
  const [narrationOutput, setNarrationOutput] = useState("");
  const narrationOutputReset = useRef("");
  const [narrationIsLoading, setNarrationIsLoading] = useState(false);
  const [narrationError, setNarrationError] = useState<string | null>(null);

  const { state, setState } = useStateStore(
    useShallow((state) => ({
      state: state,
      setState: state.set,
    })),
  );

  // Effect to update narration text areas when lastNarrationContext changes
  useEffect(() => {
    if (state.lastNarrationContext) {
      setNarrationPrompt(state.lastNarrationContext.lastPrompt);
      narrationReset.current = state.lastNarrationContext.lastPrompt;      
      setNarrationOutput(state.lastNarrationContext.lastNarrationEvent.text);
      narrationOutputReset.current = state.lastNarrationContext.lastNarrationEvent.text;
    }
  }, [state.lastNarrationContext]);

  // Function to handle changes in the narration prompt textarea
  const handlePromptChange = (event: React.ChangeEvent<HTMLTextAreaElement>) => {
    setNarrationPrompt(event.target.value);
  };

  const handleGeneratePrompt = async () => {
    if (narrationIsLoading) return;
    setNarrationIsLoading(true);
    setNarrationError(null);
    setNarrationOutput("Narrating...");

    try {
      const prompt: Prompt = {
        // This system prompt is hardcoded in lib/prompts.ts and should be consistent.
        system: "You are the game master of a text-based fantasy role-playing game.",
        user: narrationPrompt,
      };
      const result = await appBackend.getNarration(prompt);
      setNarrationOutput(result);
    } catch (error: any) {
      setNarrationError(error.message || "An unknown error occurred.");
    } finally {
      setNarrationIsLoading(false);
    }
  };

  const handleReplaceNarration = async () => {
    setState((stateDraft) => {
      let lastNarrationEventIndex = -1;
        for (let i = stateDraft.events.length - 1; i >= 0; i--) {
          if (stateDraft.events[i].type === "narration") {
            lastNarrationEventIndex = i;
            break;
          }
        }
        if (lastNarrationEventIndex !== -1) {
          // Cast to any to avoid type issues with Zod discriminated union
          (stateDraft.events[lastNarrationEventIndex] as any).text = narrationOutput;
        } else {
          console.error("No narration event found in the events array to replace.");
          setNarrationError("No narration event found in the events array to replace.");
        }
      }
    );
    setNarrationError(null); // Clear any previous errors
    handleReplaceActions();
  };

  const handleReplaceActions = async () => {
    if (narrationIsLoading) return;
    setNarrationIsLoading(true);
    setNarrationError(null);

    try {
      const newActions = await appBackend.getObject(await generateActionsPrompt(getState()), z.array(Action));
      setState((stateDraft) => {
        stateDraft.actions = newActions;
      });
    } catch (error: any) {
      setNarrationError(error.message || "An unknown error occurred.");
    } finally {
      setNarrationIsLoading(false);
    }
  };

  // Remove properties containing functions to avoid corrupting them,
  // as functions cannot be edited and would be overwritten by garbage.
  const filteredState: Partial<StoredState> = { ...state };
  // delete filteredState.plugins;
  delete filteredState.backends;
  delete filteredState.set;
  delete filteredState.setAsync;

  return (
    <Dialog.Root open={dialogOpen} onOpenChange={setDialogOpen} modal={false}>
      <Tooltip
        content={
          <>
            <Text size="5">Open state debugger</Text>
            <br />
            <Text className="text-red-600" size="3" weight="bold">
              May contain spoilers!
            </Text>
          </>
        }
      >
        <IconButton onClick={() => setDialogOpen(true)} className="fixed top-3 right-3" variant="ghost" color="gray">
          <GiAllSeeingEye size="35" />
        </IconButton>
      </Tooltip>

      <Dialog.Portal>
        <Dialog.Content
          onPointerDownOutside={(event) => event.preventDefault()}
          onInteractOutside={(event) => event.preventDefault()}
          className="fixed top-0 right-0 bottom-0 w-xs grid overflow-auto pl-1 border-l border-(--gold-10) bg-[rgb(30,30,30)]"
        >
          <VisuallyHidden> 
            <Dialog.Title className="DialogTitle">State debugger</Dialog.Title>
          </VisuallyHidden>
          <ReactJsonView
            src={filteredState}
            name="state"
            theme="twilight"
            displayObjectSize={false}
            displayDataTypes={false}
            quotesOnKeys={false}
            enableClipboard={false}
            indentWidth={2}
            collapsed={1}
            collapseStringsAfterLength={100}
            onAdd={(edit) => setState(edit.updated_src)}
            onEdit={(edit) => setState(edit.updated_src)}
            onDelete={(edit) => setState(edit.updated_src)}
          />

          {/* New section for Prompt Testing Screen */}
          <div className="mt-4 p-2 border-t border-gray-700">
            <div className="flex items-center cursor-pointer" onClick={() => setPromptEditorExpanded(!promptEditorExpanded)}>
              {promptEditorExpanded ? (
                <RxTriangleDown className="mr-1 text-amber-500" />
              ) : (
                <RxTriangleRight className="mr-1 text-amber-500" />
              )}
              <h3 className="text-lg font-bold text-white">Narration Editor</h3>
            </div>
            {promptEditorExpanded && (
              <div className="mt-2">
                <p className="text-white">Prompt Used:</p>
                <textarea
                  className="w-full bg-gray-700 text-white p-2 rounded resize-y"
                  value={narrationPrompt}
                  onChange={handlePromptChange}
                  rows={10}
                />
                <p className="mt-4 text-white">Generated Narration:</p>
                <textarea
                  className="w-full bg-gray-800 text-gray-300 p-2 rounded resize-y"
                  value={narrationOutput}
                  onChange={(e) => setNarrationOutput(e.target.value)}
                  rows={10}
                  disabled={narrationIsLoading}
                />
                {narrationError && <p className="mt-2 text-red-500">Error: {narrationError}</p>}
                <div className="mt-4 flex justify-around">
                  <Tooltip content="Generate">
                    <IconButton
                      variant="ghost"
                      color="amber"
                      onClick={handleGeneratePrompt}
                      disabled={narrationIsLoading}
                    >
                      {narrationIsLoading ? (
                        <GiBigGear size="30" className="animate-spin text-amber-400" />
                      ) : (
                        <GiAcousticMegaphone size="30" />
                      )}
                    </IconButton>
                  </Tooltip>
                  <Tooltip content="Reset">
                    <IconButton
                      variant="ghost"
                      color="crimson"
                      onClick={() => {
                        setNarrationPrompt(narrationReset.current);
                        setNarrationOutput(narrationOutputReset.current);
                      }}
                    >
                      <GiCancel size="30" />
                    </IconButton>
                  </Tooltip>
                  <Tooltip content="Replace">
                    <IconButton variant="ghost" color="grass" 
                    onClick={handleReplaceNarration}
                    >
                      <GiCardExchange size="30" />
                    </IconButton>
                  </Tooltip>
                </div>
              </div>
            )}
          </div>

          <Dialog.Close asChild>
            <IconButton className="fixed top-1 right-1" variant="ghost" aria-label="Close">
              <RxCross2 size="20" />
            </IconButton>
          </Dialog.Close>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
