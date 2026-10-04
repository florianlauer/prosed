# prosed

A grammar checker and rewriter that runs on a local model. The browser extension and the desktop app are two hosts for the same checks.

## Language

### Checking

**Check**:
One request to the model to correct the checkable core of a field's text.
_Avoid_: scan, lint

**Check session**:
The checks of one field as the user types it: the latest text, whether a check is waiting or running, and the fixes it found.
_Avoid_: control, state machine

**Checkable core**:
The part of a field's text that is checked, without the blank lines around it or an email signature.

**Fix**:
One change the model proposes, which the user can accept or ignore on its own.
_Avoid_: suggestion, correction, hunk (in prose)

**Dictionary**:
Words the user's checks never change, matched as whole words with their exact case.

**Ignored change**:
A fix the user refused, as a word-for-word pair, never proposed again anywhere.

### Rewriting

**Rewrite**:
Up to three versions of a selection or sentence that the model wrote and the checks kept.

**Variant**:
One version in a rewrite.

**Tone preset**:
The direction a rewrite takes: clearer, more formal, friendlier, more confident, shorter, or more natural.
_Avoid_: style (that is the user's spelling and address preferences)

**Long sentence**:
A sentence of more than 30 words, offered for a rewrite.

**Formality meter**:
How formal a text sounds, on a scale from 1 (very casual) to 5 (very formal).

### Hosts and models

**Host**:
The program a check runs in: the browser extension or the desktop app.

**Model backend**:
Where the model runs: Ollama, or Gemini Nano built into Chrome.
_Avoid_: provider (in prose)

**Channel**:
A kind of model request, so a new request cancels only the previous one of the same kind.
