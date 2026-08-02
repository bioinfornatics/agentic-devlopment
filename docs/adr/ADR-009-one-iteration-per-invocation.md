# ADR-009 : Boucle comportementale intra-session avec Beads comme pont de compaction

La recette `loop-engineering` tourne entièrement dans **une seule session Goose**. Le LLM exécute les 7 étapes (Trigger → Contrôleur), persiste la Transition dans Beads, puis repart à l'étape 1 dans la même session — comportementalement, sans relancement externe. La session ne se termine que sur une Transition terminale (COMPLETE, ESCALATE, ABORT) ou à l'atteinte de `max_turns: 80`.

## Considered Options

- **Boucle externe** — la recette sort sur CONTINUE, un orchestrateur ou l'humain relance `goose recipe run` avec le même `run_id`. Requiert un scheduler, ajoute de la latence, et complexifie le handoff entre invocations.
- **Boucle comportementale intra-session avec pont disque (`.loop/`)** — le LLM écrit l'état dans `.loop/*.yaml` entre itérations. Fonctionnel, mais introduit un format propriétaire en dehors du plan de contrôle.
- **Boucle comportementale intra-session avec Beads** — retenu. Pas de fichier `.loop/`. Après chaque Transition non terminale, le LLM lit `bd show <run-id>` pour reconstituer l'état et repart à l'étape 1. Beads est déjà le plan de contrôle autoritaire — pas de redondance.

## Consequences

- Le LLM peut traverser plusieurs itérations dans la même session jusqu'à `max_turns: 80`.
- Quand la compaction automatique résume les anciens messages, l'état critique (compteurs, transitions, preuves) est reconstituable via `bd show <run-id> --json` — Beads est le seul pont durable.
- Les fichiers `.loop/` ne doivent **jamais** être créés ni lus. Toute référence à `.loop/` dans d'anciens scripts ou skills est obsolète.
- Les freins s'appliquent dans la même session : `max_turns` (limite mécanique), `max_tool_repetitions` (répétition d'outil), plugins hooks (PreToolUse/PostToolUse/Stop), `src/app/tooling/dist/loop-transition-guard.js` (garde final avant persistance).
- COMPLETE, ESCALATE et ABORT produisent le JSON de réponse final (schema `response:`) et terminent la session. CONTINUE, REPLAN, REWORK, et WAIT persistent dans Beads et rebouclent en step 1.
