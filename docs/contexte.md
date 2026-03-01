# Contexte du Projet : MarcheConnect - Le Marché de Félix

## 1. Présentation Générale
**MarcheConnect** est une application web développée pour l'association "Un jardin pour Félix". Elle vise à automatiser et centraliser la gestion des candidatures des artisans et créateurs pour le Marché de Noël annuel de Chazay d'Azergues.

L'application remplace les échanges d'emails manuels par un workflow structuré en deux étapes, garantissant une collecte de données propre et un suivi rigoureux des dossiers administratifs et financiers.

## 2. Architecture Technique
- **Framework :** Next.js 15 (App Router)
- **Langage :** TypeScript
- **Base de données :** Firebase Firestore (NoSQL)
- **Authentification :** Firebase Auth (Email/Mot de passe)
- **IA :** Genkit (Modèle Gemini 2.5 Flash) pour l'assistance à la rédaction
- **Emails :** Nodemailer (via SMTP Gmail)
- **Composants UI :** Shadcn/UI, Tailwind CSS, Lucide Icons, Leaflet (Cartographie)

## 3. Entités de Données (Firestore)
- **market_configurations :** Paramètres globaux de l'édition (Année, Prix des tables, Date du marché, etc.).
- **pre_registrations :** Dossiers des exposants incluant les données de l'Étape 1 (candidature) et de l'Étape 2 (dossier technique).
- **email_templates :** Modèles d'emails pré-enregistrés pour les communications récurrentes.
- **roles_admin :** Liste des utilisateurs ayant accès au back-office avec distinction Super Admin.
- **admin_requests :** Demandes de création de compte administrateur en attente de validation.

## 4. Fonctionnalités Clés

### A. Parcours Exposant
- **Candidature (Étape 1) :** Collecte des informations de base, description des produits et téléchargement de 3 photos (compressées côté client).
- **Dossier Technique (Étape 2) :** Formulaire accessible via lien unique. Gestion du SIRET, photo d'identité, besoins électriques, grilles d'expo, et commande de repas.
- **Calculateur de Frais :** Génération dynamique du montant total à régler en fonction des options choisies.

### B. Gestion Administrateur
- **Dashboard :** Vue d'ensemble des statistiques et suivi des délais ("Attente Dossier" ou "Attente Paiement") avec alertes visuelles après 15 jours.
- **Outils de Communication :** 
    - Envoi d'emails groupés (aux confirmés).
    - Envoi d'emails individuels avec insertion dynamique d'un bouton (CTA) vers le dossier technique.
    - Éditeur de texte libre avec barre d'outils d'enrichissement.
- **Aide à la Décision IA :** Génération de messages de refus personnalisés et argumentés basés sur le contenu de la candidature.
- **Cartographie :** Géolocalisation automatique des artisans pour visualiser le rayonnement local du marché.
- **Export Data :** Export Excel complet de tous les champs (Step 1 + Step 2) pour la gestion comptable et logistique.

### C. Configuration & Sécurité
- **Master Admin :** Accès prioritaire codé en dur pour `hugues.rabier@gmail.com`.
- **Gestion des Rôles :** Les Super Admins peuvent valider de nouveaux administrateurs et gérer les privilèges de l'équipe.
- **SMTP Tooling :** Configuration des identifiants Gmail avec masquage/affichage du mot de passe et outil de test vers une destination au choix.

## 5. Règles de Sécurité
Les règles Firestore (`firestore.rules`) sont configurées pour :
- Permettre la lecture publique des configurations de marché.
- Permettre aux exposants de créer leur fiche et de mettre à jour leur dossier technique (via ID unique).
- Restreindre l'accès à la liste complète et aux outils d'édition/suppression aux seuls administrateurs authentifiés et validés.
