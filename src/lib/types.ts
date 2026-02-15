
export type ApplicationStatus = 'pending' | 'accepted_form1' | 'rejected' | 'submitted_form2' | 'validated';

export interface Exhibitor {
  id: string;
  name: string;
  email: string;
  phone: string;
  companyName: string;
  productDescription: string;
  status: ApplicationStatus;
  rejectionReason?: string;
  rejectionJustification?: string;
  createdAt: string;
  detailedInfo?: DetailedExhibitorInfo;
}

export interface DetailedExhibitorInfo {
  boothSize: string;
  needsElectricity: boolean;
  electricityPower?: string;
  insuranceCompany: string;
  insurancePolicyNumber: string;
  additionalComments?: string;
  submittedAt: string;
}
