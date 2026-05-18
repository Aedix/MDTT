# Plan d’amélioration — Rapports MDT

Ce document synthétise les idées retenues pour la section **Rapports** du MDT FIB / multi-services.

## Direction validée

La direction UI validée repose sur une interface sombre, moderne, structurée, lisible et RP institutionnelle. Les nouveaux éléments doivent reprendre une logique de cartes MDT : bordures fines, titres courts, badges, couleurs fonctionnelles, informations hiérarchisées et consultation claire.

## Fonctionnalités retenues

### 1. Mode consultation template

En consultation, le rapport doit être affiché directement sous forme de document officiel dans le MDT, sans nécessiter l’export PDF. Le mode édition reste un formulaire, le mode consultation devient un rendu template officiel en lecture seule.

### 2. Auto-save brouillon

Les rapports en statut `Brouillon` peuvent être sauvegardés automatiquement si le contenu change. L’autosave ne doit pas s’appliquer aux rapports soumis, verrouillés ou appartenant à un autre service.

### 3. Verrouillage visuel clair

Afficher un bloc clair selon la vraie raison du verrouillage :

- `Rapport soumis — édition verrouillée` ;
- `Rapport d’un autre service — consultation uniquement`.

### 4. Filtres et badges

Ajouter des filtres par type, statut, service, classification, dates, créateur et recherche texte. Les rapports doivent afficher des badges visibles : service, type, statut, classification, citoyen/véhicule/agent lié.

### 5. Classification documentaire

Ajouter un niveau global de classification :

- Non classifié ;
- Interne service ;
- Confidentiel ;
- Restreint Command Staff ;
- Déclassifié.

Le caviardage reste séparé : il masque des passages précis, alors que la classification règle l’accès global au document.

### 6. Historique sensible

Tracer les changements de statut, de classification, de caviardage/décaviardage et les modifications importantes. Ne pas stocker le texte sensible dans les logs.

### 7. Workflow enrichi

Cycle retenu :

- Brouillon ;
- Soumis ;
- En révision CS ;
- Validé ;
- Rejeté ;
- Archivé.

Les agents peuvent créer et modifier les brouillons. Le Command Staff / Director gère validation, rejet, archive, classification et corrections.

### 8. Signature officier

Améliorer la signature avec un rendu manuscrit RP simple : nom de l’agent, signature stylisée, date de signature.

### 9. Liens rapides

En consultation, les citoyens et véhicules liés doivent être cliquables. Les agents pourront l’être plus tard quand les profils agents seront définis.

### 10. Templates de rédaction

Ajouter une aide d’écriture avec des structures préremplies par type de rapport, insérables sans écraser le texte existant sans confirmation.

### 11. Checklist légère

Ajouter une checklist informative avant soumission, surtout pour le dossier d’arrestation. Pas de score, pas de blocage obligatoire au départ.

### 12. Plein écran amélioré

Le mode grand écran du rich editor doit devenir un vrai mode focus : titre du champ, toolbar propre, bouton sauvegarder, bouton fermer.

### 13. Exports multiples

Prévoir des exports : version déclassifiée, version interne Director et version complète selon permissions.

### 14. Footer d’export

Ajouter un footer propre : numéro de rapport, date d’export, document ID, pagination si possible. Pas de QR code.

### 15. Recherche et performance

Optimiser la recherche rapports côté API, ajouter les indexes nécessaires et prévoir un endpoint filtré si nécessaire.

### 16. Versioning

Ajouter un historique de versions pour conserver les snapshots importants du rapport.

## Règle d’implémentation

Procéder par blocs, sans casser l’existant. Après chaque bloc : push GitHub, lister les fichiers à uploader, lister les migrations SQL et donner des tests précis.
