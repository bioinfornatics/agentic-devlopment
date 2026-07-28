# 06 — Contrôleur

## Finalité

Évaluer et améliorer la **méthode de travail elle-même**, puis décider de poursuivre, pivoter ou arrêter.

## Responsabilités

- analyser les métriques du cycle ;
- détecter répétitions, dérives et blocages systémiques ;
- revoir les hypothèses et garde-fous ;
- décider de la poursuite, du pivot ou de l'arrêt ;
- mettre à jour le mode opératoire ;
- reformuler l'objectif lorsque nécessaire.

## Transitions typées

Le contrôleur émet exactement une transition par itération, persistée dans Beads.

| Transition | Condition |
|---|---|
| **CONTINUE** | Prochaine action justifiée — tâche, preuve attendue et budget restant explicites |
| **REPLAN** | Plan, contrat, hypothèse ou architecture invalide |
| **REWORK** | Défaut d'implémentation borné et reproductible — même contrat |
| **WAIT** | Dépendance externe — condition de reprise exacte persistée, pas de poll |
| **COMPLETE** | Tous les critères globaux prouvés indépendamment |
| **ESCALATE** | Décision ou autorisation humaine requise — action exacte nommée |
| **ABORT** | Budget épuisé, garde-fou déclenché, ou absence de progrès répétée |

## Signaux de dérive

- mêmes erreurs répétées ;
- absence de progrès mesurable ;
- augmentation continue du coût ;
- vérifications non concluantes répétées ;
- backlog qui croît plus vite qu'il ne diminue ;
- contournements fréquents des règles ;
- écart persistant entre activité et valeur.

## Sorties obligatoires

- décision de cycle ;
- méthode révisée ;
- nouvelles contraintes ;
- objectif reformulé si nécessaire ;
- justification traçable.

## Anti-patterns

- poursuivre uniquement parce que du travail a déjà été investi ;
- changer de méthode à chaque difficulté locale ;
- réviser sans utiliser les preuves accumulées ;
- ignorer les coûts d'exploitation ;
- laisser une boucle continuer sans condition d'arrêt.
