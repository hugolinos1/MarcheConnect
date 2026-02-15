
export type ApplicationStatus = 'pending' | 'accepted_form1' | 'rejected' | 'submitted_form2' | 'validated';

export interface Exhibitor {
  id: string;
  name: string;
  email: string;
  phone: string;
  companyName: string;
  productDescription: string;
  origin: string; // Origine géographique
  isRegistered: boolean; // Déclaré au RC ou association
  websiteUrl?: string; // Adresse site marchand / réseaux
  requestedTables: '1' | '2'; // 1 ou 2 tables
  status: ApplicationStatus;
  rejectionReason?: string;
  rejectionJustification?: string;
  createdAt: string;
  detailedInfo?: DetailedExhibitorInfo;
}

export interface DetailedExhibitorInfo {
  boothSize: string; // Gardé pour compatibilité mais supplanté par requestedTables
  needsElectricity: boolean;
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
