# 03 — Vérificateur

## Finalité

Déterminer, à partir de preuves, dans quelle mesure le résultat **satisfait réellement l'objectif**.

## Responsabilités

- contrôler les faits et la provenance des preuves ;
- exécuter les tests pertinents ;
- comparer le résultat aux critères de succès ;
- mesurer les écarts ;
- qualifier le niveau de confiance ;
- produire un verdict explicite.

## Verdicts possibles

- **Accepté** : les critères sont satisfaits avec des preuves suffisantes.
- **Rejeté** : un ou plusieurs critères sont objectivement non satisfaits.
- **Incertain** : les preuves sont insuffisantes ou contradictoires.

## Sorties obligatoires

- verdict ;
- écarts constatés ;
- preuves de validation ;
- niveau de confiance ;
- actions correctives proposées.

## Règles

1. Séparer faits, hypothèses et opinions.
2. Préférer une preuve reproductible à une appréciation subjective.
3. Ne pas modifier les critères après observation du résultat sans tracer la décision.
4. Rendre visibles les résultats négatifs.
5. Employer le verdict « incertain » lorsque la preuve ne permet pas de conclure.

## Anti-patterns

- validation par la même logique que celle ayant produit le résultat ;
- test uniquement nominal ;
- absence de seuils ;
- critères changés a posteriori ;
- conclusion positive basée sur l'absence d'erreur apparente.
