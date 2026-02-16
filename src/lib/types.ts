export type ApplicationStatus = 'pending' | 'accepted_form1' | 'rejected' | 'submitted_form2' | 'validated';

export interface Exhibitor {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  companyName: string;
  productDescription: string;
  address: string;
  city: string; // Ville
  postalCode: string; // Code Postal
  isRegistered: boolean; // Déclaré au RC ou association
  websiteUrl?: string; // Adresse site marchand / réseaux
  productImages?: string[]; // 3 photos illustrant les produits (base64 compressé)
  requestedTables: '1' | '2'; // 1 ou 2 tables
  status: ApplicationStatus;
  rejectionReason?: string;
  rejectionJustification?: string;
  createdAt: string;
  agreedToGdpr: boolean; // Consentement RGPD initial
  agreedToTerms: boolean; // Acceptation règlement initial
  detailedInfo?: DetailedExhibitorInfo;
}

export interface DetailedExhibitorInfo {
  boothSize: string; // Gardé pour compatibilité mais supplanté par requestedTables
  siret?: string; // SIRET pour les pros
  idCardPhoto?: string; // Photo pièce d'identité
  needsElectricity: boolean;
  needsGrid: boolean; // Besoin d'une grille d'exposition
  sundayLunchCount: number; // Nombre de plateaux repas
  tombolaLot: boolean; // Participe à la tombola
  tombolaLotDescription?: string; // Nature du don
  insuranceCompany: string;
  insurancePolicyNumber: string;
  agreedToImageRights: boolean;
  agreedToTerms: boolean;
  additionalComments?: string;
  submittedAt: string;
}
