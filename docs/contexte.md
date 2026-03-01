
# Contexte du Projet : MarcheConnect - Le Marché de Félix

## 1. Présentation Générale
**MarcheConnect** est une application web développée pour l'association "Un jardin pour Félix". Elle vise à automatiser et centraliser la gestion des candidatures des artisans et créateurs pour le Marché de Noël annuel de Chazay d'Azergues.

L'application remplace les échanges d'emails manuels par un workflow structuré en deux étapes, garantissant une collecte de données propre et un suivi rigoureux des dossiers administratifs et financiers.

## 2. Architecture Technique
- **Framework :** Next.js 15 (App Router)
- **Langage :** TypeScript
- **Base de données :** Firebase Firestore (NoSQL)
- **Authentification :** Firebase Auth (Email/Mot de passe)
- **IA :** Genkit (Modèle Gemini 2.5 Flash) pour l'assistance à la rédaction des refus.
- **Emails :** Nodemailer (via SMTP Gmail avec mot de passe d'application).
- **Composants UI :** Shadcn/UI, Tailwind CSS, Lucide Icons, Leaflet (Cartographie).

## 3. Parcours Utilisateur

### A. Exposant (Candidat)
1. **Étape 1 (Candidature) :** Formulaire public collectant les informations de base, la nature du stand et 3 photos (compressées localement).
2. **Étape 2 (Dossier Technique) :** Accessible via un lien unique après acceptation. Collecte du SIRET, pièce d'identité, besoins logistiques (électricité, grilles), assurance et commande de repas.
3. **Paiement :** Calculateur dynamique du montant total dû à régler par chèque.

### B. Administrateur
1. **Pilotage :** Dashboard avec statistiques et suivi visuel des délais (Attente Dossier / Paiement) avec alertes après 15 jours.
2. **Communication :** 
   - Envoi d'emails individuels avec bouton CTA vers le dossier technique.
   - Envoi d'emails groupés aux exposants confirmés.
   - Éditeur de texte enrichi (gras, italique, etc.) pour des messages personnalisés sans HTML.
3. **Logistique :** 
   - Cartographie interactive pour visualiser le rayonnement des artisans.
   - Édition directe des fiches exposants (crayon) pour ajuster les besoins (ex: modifier le nombre de repas).
   - Export Excel exhaustif de toutes les données (Step 1 + Step 2).

## 4. Configuration & Sécurité
- **Paramétrage Global :** Gestion de l'affiche, des dates, des horaires et de la grille tarifaire.
- **Outils SMTP :** Configuration sécurisée Gmail avec test d'envoi vers une destination personnalisée et visibilité des mots de passe (œil).
- **Master Admin :** Accès prioritaire codé pour `hugues.rabier@gmail.com`.
- **Gestion d'Équipe :** Système de validation des nouveaux admins et gestion des droits Super Admin.

## 5. Entités Firestore
- `market_configurations` : Paramètres de l'édition annuelle.
- `pre_registrations` : Dossiers des exposants (Step 1 + Step 2).
- `email_templates` : Modèles de communication pré-enregistrés.
- `roles_admin` : Privilèges des utilisateurs du back-office.
- `admin_requests` : Demandes de création de compte en attente.
- `exhibitor_details` : Données techniques détaillées (Step 2).
