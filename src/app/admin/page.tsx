
"use client"
import React, { useEffect, useState, useMemo, useRef } from 'react';
import dynamic from 'next/dynamic';
import { Exhibitor, ApplicationStatus } from '@/lib/types';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ChristmasSnow } from '@/components/ChristmasSnow';
import { CheckCircle, XCircle, Search, Mail, Loader2, Trash2, Eye, ShieldCheck, Sparkles, Download, Settings, Clock, ArrowLeft, Key, UserPlus, EyeOff, Plus, Send, Type, WrapText, Bold, Italic, Underline, Link as LucideLink, Image as ImageIcon, Zap, Utensils, Gift, Calculator, MessageSquare, FileText, X as XIcon, Map as MapIcon, Lock, ExternalLink, AlertTriangle, Link2 } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import Link from 'next/link';
import { sendAcceptanceEmail, sendRejectionEmail, sendBulkEmailAction, sendTestEmailAction } from '@/app/actions/email-actions';
import { useToast } from '@/hooks/use-toast';
import { useFirestore, useMemoFirebase, useCollection, useUser, useAuth, useDoc } from '@/firebase';
import { collection, doc, query, orderBy, where } from 'firebase/firestore';
import { updateDocumentNonBlocking, setDocumentNonBlocking, deleteDocumentNonBlocking, addDocumentNonBlocking } from '@/firebase/non-blocking-updates';
import { initiateEmailSignIn, initiateEmailSignUp } from '@/firebase/non-blocking-login';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import * as XLSX from 'xlsx';
import { generateRejectionJustification } from '@/ai/flows/generate-rejection-justification';
import { differenceInDays } from 'date-fns';

// Helper for status display
export const getStatusLabel = (status: ApplicationStatus): string => {
  const labels: Record<ApplicationStatus, string> = {
    pending: "À l'étude",
    accepted_form1: "Accepté (Étape 1)",
    rejected: "Refusé",
    submitted_form2: "Dossier technique reçu",
    validated: "Confirmé"
  };
  return labels[status] || status;
};

export const getStatusVariant = (status: ApplicationStatus): "default" | "secondary" | "destructive" | "outline" => {
  const variants: Record<ApplicationStatus, "default" | "secondary" | "destructive" | "outline"> = {
    pending: "secondary",
    accepted_form1: "secondary",
    rejected: "destructive",
    submitted_form2: "secondary",
    validated: "default"
  };
  return variants[status] || "secondary";
};

// Load map dynamically to avoid SSR errors with Leaflet
const AdminMap = dynamic(() => import('@/components/AdminMap').then(mod => mod.AdminMap), {
  ssr: false,
  loading: () => (
    <div className="w-full h-[600px] bg-muted/20 animate-pulse rounded-2xl flex items-center justify-center">
      <Loader2 className="w-8 h-8 animate-spin text-primary/30" />
    </div>
  )
});

export default function AdminDashboard() {
  const { toast } = useToast();
  const db = useFirestore();
  const auth = useAuth();
  const { user, isUserLoading } = useUser();
  const templateTextareaRef = useRef<HTMLTextAreaElement>(null);
  const singleEmailTextareaRef = useRef<HTMLTextAreaElement>(null);
  
  const [searchTerm, setSearchTerm] = useState('');
  const [isAuthLoading, setIsAuthLoading] = useState(false);
  const [isSigningUp, setIsSigningUp] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showSmtpPass, setShowSmtpPass] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [isSendingTest, setIsSendingTest] = useState(false);
  const [justification, setJustification] = useState('');
  const [acceptanceMessage, setAcceptanceMessage] = useState('');
  const [selectedConfigId, setSelectedConfigId] = useState<string>('');
  const [viewingExhibitor, setViewingExhibitor] = useState<Exhibitor | null>(null);
  
  const [isAcceptDialogOpen, setIsAcceptDialogOpen] = useState(false);
  const [isRejectDialogOpen, setIsRejectDialogOpen] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [isSingleEmailDialogOpen, setIsSingleEmailDialogOpen] = useState(false);
  const [actingExhibitor, setActingExhibitor] = useState<Exhibitor | null>(null);
  
  const [isBulkEmailDialogOpen, setIsBulkEmailDialogOpen] = useState(false);
  const [selectedTemplateId, setSelectedTemplateId] = useState<string>('');
  const [singleEmailForm, setSingleEmailForm] = useState({ subject: '', body: '' });
  const [isTemplatePreviewMode, setIsTemplatePreviewMode] = useState(false);
  const [isSingleEmailPreviewMode, setIsSingleEmailPreviewMode] = useState(false);
  const [isTemplateFormVisible, setIsTemplateFormVisible] = useState(false);
  
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [signupCodeInput, setSignupCodeInput] = useState('');
  const [inputActivationCode, setInputActivationCode] = useState('');
  const [authError, setAuthError] = useState('');
  const [testEmailAddress, setTestEmailAddress] = useState('');

  const logoUrl = "https://i.ibb.co/yncRPkvR/logo-ujpf.jpg";
  
  const userRoleRef = useMemoFirebase(() => user ? doc(db, 'roles_admin', user.uid) : null, [db, user]);
  const { data: userRoleDoc, isLoading: isRoleLoading } = useDoc(userRoleRef);
  
  const isSuperAdmin = user?.email === "hugues.rabier@gmail.com" || !!userRoleDoc?.isSuperAdmin;
  const isAuthorized = isSuperAdmin || !!userRoleDoc;

  const myRequestRef = useMemoFirebase(() => user ? doc(db, 'admin_requests', user.uid) : null, [db, user]);
  const { data: myRequest } = useDoc(myRequestRef);

  const marketConfigsQuery = useMemoFirebase(() => query(collection(db, 'market_configurations'), orderBy('marketYear', 'desc')), [db]);
  const { data: configs } = useCollection(marketConfigsQuery);
  
  const currentConfig = useMemo(() => {
    if (!configs) return null;
    return configs.find(c => c.id === selectedConfigId) || configs.find(c => c.currentMarket) || configs[0];
  }, [configs, selectedConfigId]);

  useEffect(() => {
    if (currentConfig && !selectedConfigId) {
      setSelectedConfigId(currentConfig.id);
    }
  }, [currentConfig, selectedConfigId]);

  useEffect(() => {
    if (user?.email) {
      setTestEmailAddress(user.email);
    }
  }, [user]);

  const templatesQuery = useMemoFirebase(() => {
    if (!isAuthorized) return null;
    return query(collection(db, 'email_templates'), orderBy('createdAt', 'desc'));
  }, [db, isAuthorized]);
  const { data: templates } = useCollection(templatesQuery);

  const adminRequestsQuery = useMemoFirebase(() => isSuperAdmin ? query(collection(db, 'admin_requests'), orderBy('requestedAt', 'desc')) : null, [db, isSuperAdmin]);
  const { data: adminRequests } = useCollection(adminRequestsQuery);

  const adminRolesQuery = useMemoFirebase(() => isSuperAdmin ? collection(db, 'roles_admin') : null, [db, isSuperAdmin]);
  const { data: adminRoles } = useCollection(adminRolesQuery);

  const exhibitorsQuery = useMemoFirebase(() => {
    if (!isAuthorized || !selectedConfigId) return null;
    return query(collection(db, 'pre_registrations'), where('marketConfigurationId', '==', selectedConfigId));
  }, [db, isAuthorized, selectedConfigId]);
  
  const { data: exhibitorsData, isLoading: isExhibitorsLoading } = useCollection<Exhibitor>(exhibitorsQuery);

  const filteredExhibitors = useMemo(() => {
    if (!exhibitorsData) return [];
    return exhibitorsData.filter(e => 
      e.companyName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      `${e.firstName} ${e.lastName}`.toLowerCase().includes(searchTerm.toLowerCase())
    );
  }, [exhibitorsData, searchTerm]);

  const confirmedExhibitors = useMemo(() => {
    if (!exhibitorsData) return [];
    return exhibitorsData.filter(e => e.status === 'validated');
  }, [exhibitorsData]);

  const stats = useMemo(() => {
    if (!exhibitorsData) return { total: 0, pending: 0, accepted: 0, rejected: 0, validated: 0, submitted: 0, revenue: 0 };
    let totalRevenue = 0;
    const priceTable1 = currentConfig?.priceTable1 ?? 40;
    const priceTable2 = currentConfig?.priceTable2 ?? 60;
    const priceMeal = currentConfig?.priceMeal ?? 8;
    const priceElec = currentConfig?.priceElectricity ?? 1;

    exhibitorsData.forEach(e => {
      if (e.status === 'submitted_form2' || e.status === 'validated') {
        const stand = e.requestedTables === '1' ? priceTable1 : priceTable2;
        const meals = (e.detailedInfo?.sundayLunchCount || 0) * priceMeal;
        const elec = e.detailedInfo?.needsElectricity ? priceElec : 0;
        totalRevenue += (stand + meals + elec);
      }
    });

    return {
      total: exhibitorsData.length,
      pending: exhibitorsData.filter(e => e.status === 'pending').length,
      accepted: exhibitorsData.filter(e => e.status === 'accepted_form1').length,
      rejected: exhibitorsData.filter(e => e.status === 'rejected').length,
      validated: exhibitorsData.filter(e => e.status === 'validated').length,
      submitted: exhibitorsData.filter(e => e.status === 'submitted_form2').length,
      revenue: totalRevenue
    };
  }, [exhibitorsData, currentConfig]);

  const [configForm, setConfigForm] = useState({
    marketYear: 2026,
    editionNumber: "6ème",
    posterImageUrl: "https://i.ibb.co/3y3KRNW4/Affiche-March.jpg",
    notificationEmail: "lemarchedefelix2020@gmail.com",
    smtpUser: "",
    smtpPass: "",
    signupCode: "FELIX2026",
    priceTable1: 40,
    priceTable2: 60,
    priceMeal: 8,
    priceElectricity: 1,
    priceTombola: 2,
    saturdayDate: "5/12/2026",
    saturdayHours: "14h à 19h",
    sundayDate: "06/12/2026",
    sundayHours: "10h à 17h30"
  });

  useEffect(() => {
    if (currentConfig) {
      setConfigForm({
        marketYear: currentConfig.marketYear,
        editionNumber: currentConfig.editionNumber,
        posterImageUrl: currentConfig.posterImageUrl,
        notificationEmail: currentConfig.notificationEmail || "lemarchedefelix2020@gmail.com",
        smtpUser: currentConfig.smtpUser || "",
        smtpPass: currentConfig.smtpPass || "",
        signupCode: currentConfig.signupCode || "FELIX2026",
        priceTable1: currentConfig.priceTable1 ?? 40,
        priceTable2: currentConfig.priceTable2 ?? 60,
        priceMeal: currentConfig.priceMeal ?? 8,
        priceElectricity: currentConfig.priceElectricity ?? 1,
        priceTombola: currentConfig.priceTombola ?? 2,
        saturdayDate: currentConfig.saturdayDate || "5/12/2026",
        saturdayHours: currentConfig.saturdayHours || "14h à 19h",
        sundayDate: currentConfig.sundayDate || "06/12/2026",
        sundayHours: currentConfig.sundayHours || "10h à 17h30"
      });
    }
  }, [currentConfig]);

  const [editingTemplateId, setEditingTemplateId] = useState<string | null>(null);
  const [templateForm, setTemplateForm] = useState({ name: '', subject: '', body: '' });

  const handleSaveTemplate = () => {
    if (!templateForm.name || !templateForm.subject || !templateForm.body) return;
    if (editingTemplateId) {
      updateDocumentNonBlocking(doc(db, 'email_templates', editingTemplateId), templateForm);
    } else {
      addDocumentNonBlocking(collection(db, 'email_templates'), { ...templateForm, createdAt: new Date().toISOString() });
    }
    setEditingTemplateId(null);
    setIsTemplateFormVisible(false);
    setTemplateForm({ name: '', subject: '', body: '' });
    toast({ title: "Template enregistré" });
  };

  const handleSendTestEmail = async (subject?: string, body?: string) => {
    const testSubject = subject || templateForm.subject || "Email de test - MarcheConnect";
    const testBody = body || templateForm.body || "<p>Ceci est un email de test pour valider la configuration SMTP.</p>";

    if (!testEmailAddress) {
      toast({ variant: "destructive", title: "Champs manquants", description: "Veuillez renseigner une adresse email de test." });
      return;
    }
    
    setIsSendingTest(true);
    const res = await sendTestEmailAction(testEmailAddress, testSubject, testBody, configForm);
    if (res.success) {
      toast({ title: "Email de test envoyé !" });
    } else {
      toast({ variant: "destructive", title: "Échec de l'envoi", description: res.error });
    }
    setIsSendingTest(false);
  };

  const insertTag = (ref: React.RefObject<HTMLTextAreaElement>, tag: string, setter: React.Dispatch<React.SetStateAction<any>>, closeTag?: string) => {
    if (!ref.current) return;
    const textarea = ref.current;
    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const text = textarea.value;
    const selected = text.substring(start, end);
    const before = text.substring(0, start);
    const after = text.substring(end);

    let newText = "";
    if (closeTag) {
      newText = `${before}<${tag}>${selected}</${closeTag || tag}>${after}`;
    } else {
      newText = `${before}<${tag}/>${after}`;
    }

    setter((prev: any) => ({ ...prev, body: newText }));
    setTimeout(() => {
      textarea.focus();
      textarea.setSelectionRange(start + tag.length + 2, start + tag.length + 2 + selected.length);
    }, 0);
  };

  const insertSnippet = (ref: React.RefObject<HTMLTextAreaElement>, snippet: string, setter: React.Dispatch<React.SetStateAction<any>>) => {
    if (!ref.current) return;
    const textarea = ref.current;
    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const text = textarea.value;
    const before = text.substring(0, start);
    const after = text.substring(end);

    const newText = `${before}${snippet}${after}`;
    setter((prev: any) => ({ ...prev, body: newText }));
    setTimeout(() => {
      textarea.focus();
      textarea.setSelectionRange(start + snippet.length, start + snippet.length);
    }, 0);
  };

  const handleBulkEmailSend = async () => {
    const template = templates?.find(t => t.id === selectedTemplateId);
    if (!template || confirmedExhibitors.length === 0) return;
    setIsSending(true);
    const emails = confirmedExhibitors.map(e => e.email);
    const res = await sendBulkEmailAction(emails, template.subject, template.body, currentConfig);
    if (res.success) {
      toast({ title: "Emails envoyés !", description: `${res.totalSent} emails envoyés avec succès.` });
    } else {
      toast({ variant: "destructive", title: "Erreur lors de l'envoi", description: `${res.totalSent} envoyés, ${res.totalFailed} échoués.` });
    }
    setIsBulkEmailDialogOpen(false);
    setIsSending(false);
  };

  const handleSingleEmailSend = async () => {
    if (!actingExhibitor || !singleEmailForm.subject || !singleEmailForm.body) return;
    setIsSending(true);
    const res = await sendBulkEmailAction([actingExhibitor.email], singleEmailForm.subject, singleEmailForm.body, currentConfig);
    if (res.success) {
      toast({ title: "Email envoyé !" });
    } else {
      toast({ variant: "destructive", title: "Échec de l'envoi", description: res.error });
    }
    setIsSingleEmailDialogOpen(false);
    setIsSending(false);
    setActingExhibitor(null);
  };

  const handleAuth = async (e: React.FormEvent, forceRequest: boolean = false) => {
    e.preventDefault();
    setAuthError('');
    setIsAuthLoading(true);

    if (!email || !password) {
      setAuthError("Email et mot de passe requis.");
      setIsAuthLoading(false);
      return;
    }

    try {
      let userCred;
      if (isSigningUp || forceRequest) {
        try {
          userCred = await initiateEmailSignUp(auth, email, password);
        } catch (err: any) {
          if (err.code === 'auth/email-already-in-use') {
            try {
              userCred = await initiateEmailSignIn(auth, email, password);
            } catch (signInErr: any) {
              if (signInErr.code === 'auth/wrong-password' || signInErr.code === 'auth/invalid-credential') {
                setAuthError("Ce compte existe déjà. Veuillez utiliser le bon mot de passe pour solliciter votre code.");
                setIsAuthLoading(false);
                return;
              }
              throw signInErr;
            }
          } else {
            throw err;
          }
        }
        
        const uid = userCred.user.uid;
        
        if (forceRequest) {
          const autoGeneratedCode = Math.floor(100000 + Math.random() * 900000).toString();
          setDocumentNonBlocking(doc(db, 'admin_requests', uid), { 
            email: email, 
            requestedAt: new Date().toISOString(), 
            status: 'PENDING',
            invitationCode: autoGeneratedCode
          }, { merge: true });
          toast({ title: "Demande envoyée", description: "Votre compte est prêt. Un administrateur doit maintenant vous fournir votre code d'activation." });
        } else {
          const masterCode = currentConfig?.signupCode || "FELIX2026";
          if (signupCodeInput === masterCode) {
            if (email === "hugues.rabier@gmail.com") {
              setDocumentNonBlocking(doc(db, 'roles_admin', uid), { addedAt: new Date().toISOString(), email: email, isSuperAdmin: true }, { merge: true });
              toast({ title: "Accès activé immédiatement !" });
            } else {
              setDocumentNonBlocking(doc(db, 'admin_requests', uid), { 
                email: email, 
                requestedAt: new Date().toISOString(), 
                status: 'PENDING',
                invitationCode: signupCodeInput
              }, { merge: true });
              toast({ title: "Demande en attente", description: "Votre demande est en cours de validation par l'administrateur." });
            }
          } else {
            setAuthError("Code de création invalide.");
          }
        }
      } else {
        await initiateEmailSignIn(auth, email, password);
      }
    } catch (err: any) {
      if (err.code === 'auth/wrong-password' || err.code === 'auth/invalid-credential') {
        setAuthError("Email ou mot de passe incorrect.");
      } else if (err.code === 'auth/user-not-found') {
        setAuthError("Compte non trouvé.");
      } else {
        setAuthError("Erreur : " + (err.message || "Veuillez réessayer."));
      }
    } finally {
      setIsAuthLoading(false);
    }
  };

  const handleUnlockWithCode = () => {
    const masterCode = currentConfig?.signupCode || "FELIX2026";
    const personalCode = myRequest?.invitationCode;

    if (inputActivationCode === masterCode || (personalCode && inputActivationCode === personalCode)) {
      toast({ title: "Code correct !", description: "L'administrateur va valider votre accès définitivement." });
    } else {
      toast({ variant: "destructive", title: "Code erroné", description: "Veuillez vérifier le code envoyé par l'admin." });
    }
  };

  const handleManualRequest = () => {
    const autoGeneratedCode = Math.floor(100000 + Math.random() * 900000).toString();
    setDocumentNonBlocking(doc(db, 'admin_requests', user!.uid), { 
      email: user!.email, 
      requestedAt: new Date().toISOString(), 
      status: 'PENDING',
      invitationCode: autoGeneratedCode
    }, { merge: true });
    toast({ title: "Demande envoyée !", description: "L'administrateur a été notifié. Demandez-lui votre code d'activation." });
  };

  const handleDeleteExhibitor = () => {
    if (!actingExhibitor) return;
    deleteDocumentNonBlocking(doc(db, 'pre_registrations', actingExhibitor.id));
    setIsDeleteDialogOpen(false);
    setActingExhibitor(null);
    toast({ title: "Exposant supprimé" });
  };

  const getDelayInfo = (exhibitor: Exhibitor) => {
    let startDate: string | undefined;
    let label = "";

    if (exhibitor.status === 'accepted_form1') {
      startDate = exhibitor.acceptedAt;
      label = "attente dossier";
    } else if (exhibitor.status === 'submitted_form2') {
      startDate = exhibitor.detailedInfo?.submittedAt;
      label = "attente chèque";
    }

    if (!startDate) return null;

    const days = differenceInDays(new Date(), new Date(startDate));
    let colorClass = "text-muted-foreground";
    let icon = <Clock className="w-3 h-3" />;
    
    if (days >= 30) {
      colorClass = "text-destructive font-bold";
      icon = <AlertTriangle className="w-3 h-3" />;
    } else if (days >= 15) {
      colorClass = "text-orange-500 font-bold";
      icon = <Clock className="w-3 h-3" />;
    }
    
    return (
      <div className={`flex items-center gap-1 text-[10px] mt-1 ${colorClass}`}>
        {icon}
        {days}j ({label})
      </div>
    );
  };

  const handleExportExcel = () => {
    if (!filteredExhibitors) return;

    const exportData = filteredExhibitors.map(e => {
      const info = e.detailedInfo;
      return {
        "Enseigne": e.companyName,
        "Nom": e.lastName,
        "Prénom": e.firstName,
        "Email": e.email,
        "Téléphone": e.phone,
        "Statut Actuel": getStatusLabel(e.status),
        "Type": e.isRegistered ? "Professionnel" : "Particulier",
        "Adresse": e.address,
        "Ville": e.city,
        "Code Postal": e.postalCode,
        "Site / Réseaux": e.websiteUrl || "",
        "Description Stand": e.productDescription,
        "Tables Souhaitées": e.requestedTables,
        "Date Préinscription": e.createdAt ? new Date(e.createdAt).toLocaleString() : "",
        "Date Acceptation (S1)": e.acceptedAt ? new Date(e.acceptedAt).toLocaleString() : "",
        
        // Détails techniques (si disponibles)
        "SIRET": info?.siret || "",
        "Besoin Électricité": info?.needsElectricity ? "Oui" : "Non",
        "Besoin Grille": info?.needsGrid ? "Oui" : "Non",
        "Repas Dimanche": info?.sundayLunchCount || 0,
        "Lot Tombola": info?.tombolaLot ? "Oui" : "Non",
        "Description Lot": info?.tombolaLotDescription || "",
        "Compagnie Assurance": info?.insuranceCompany || "",
        "Police Assurance": info?.insurancePolicyNumber || "",
        "Droits Image": info?.agreedToImageRights ? "Accepté" : "Non renseigné",
        "Date Dossier Tech": info?.submittedAt ? new Date(info.submittedAt).toLocaleString() : "",
        "Commentaires Admin": info?.additionalComments || ""
      };
    });

    const ws = XLSX.utils.json_to_sheet(exportData);
    const wscols = [
      { wch: 25 }, { wch: 15 }, { wch: 15 }, { wch: 25 }, { wch: 15 }, { wch: 20 }, { wch: 15 }, { wch: 30 }, { wch: 20 }, { wch: 10 }, { wch: 25 }, { wch: 40 }, { wch: 10 }, { wch: 20 }, { wch: 20 }, { wch: 20 }, { wch: 10 }, { wch: 10 }, { wch: 10 }, { wch: 10 }, { wch: 30 }, { wch: 20 }, { wch: 20 }, { wch: 15 }, { wch: 20 }, { wch: 40 }
    ];
    ws['!cols'] = wscols;

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Exposants");
    XLSX.writeFile(wb, `Exposants_Complet_${currentConfig?.marketYear || 'Export'}.xlsx`);
    toast({ title: "Export Excel généré" });
  };

  const EditorToolbar = ({ textareaRef, setter, isPreview, onTogglePreview, showDossierLink = false }: any) => (
    <div className="flex flex-wrap items-center justify-between gap-2 p-2 bg-muted rounded-t-lg border-x border-t">
      <div className="flex flex-wrap gap-1">
        <Button variant="ghost" size="sm" className="h-8 w-8 p-0" onClick={() => insertTag(textareaRef, 'b', setter, 'b')} title="Gras"><Bold className="w-4 h-4" /></Button>
        <Button variant="ghost" size="sm" className="h-8 w-8 p-0" onClick={() => insertTag(textareaRef, 'i', setter, 'i')} title="Italique"><Italic className="w-4 h-4" /></Button>
        <Button variant="ghost" size="sm" className="h-8 w-8 p-0" onClick={() => insertTag(textareaRef, 'u', setter, 'u')} title="Souligné"><Underline className="w-4 h-4" /></Button>
        <Separator orientation="vertical" className="h-6 mx-1" />
        <Button variant="ghost" size="sm" className="h-8 w-8 p-0" onClick={() => insertTag(textareaRef, 'p', setter, 'p')} title="Paragraphe"><Type className="w-4 h-4" /></Button>
        <Button variant="ghost" size="sm" className="h-8 w-8 p-0" onClick={() => insertTag(textareaRef, 'br', setter)} title="Saut de ligne"><WrapText className="w-4 h-4" /></Button>
        <Separator orientation="vertical" className="h-6 mx-1" />
        <Button 
          variant="ghost" 
          size="sm" 
          className="h-8 px-2 text-[10px] gap-1"
          onClick={() => {
            const url = prompt("URL du lien :", "https://");
            if (url) insertSnippet(textareaRef, `<a href="${url}" style="color: #2E3192; font-weight: bold; text-decoration: underline;">Lien</a>`, setter);
          }}
        >
          <LucideLink className="w-3 h-3" /> Lien
        </Button>
        {showDossierLink && (
          <Button 
            variant="outline" 
            size="sm" 
            className="h-8 px-2 text-[10px] gap-1 border-primary/30 text-primary hover:bg-primary/5 font-bold"
            onClick={() => {
              if (actingExhibitor) {
                const baseUrl = window.location.origin;
                const link = `${baseUrl}/details/${actingExhibitor.id}`;
                const snippet = `<p>Voici votre lien unique pour compléter votre dossier technique : <br/><a href="${link}" style="color: #2E3192; font-weight: bold; text-decoration: underline;">Accéder à mon dossier technique</a></p>`;
                insertSnippet(textareaRef, snippet, setter);
              }
            }}
          >
            <Link2 className="w-3 h-3" /> Lien Dossier
          </Button>
        )}
      </div>
      <Button 
        variant="secondary" 
        size="sm" 
        onClick={onTogglePreview} 
        className="h-8 px-2 text-[10px] gap-1"
      >
        {isPreview ? <><Type className="w-3 h-3" /> Rédiger</> : <><Eye className="w-3 h-3" /> Aperçu</>}
      </Button>
    </div>
  );

  if (isUserLoading || isRoleLoading) return <div className="min-h-screen flex items-center justify-center"><Loader2 className="animate-spin text-primary" /></div>;

  if (!user) {
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center p-4">
        <Card className="max-w-md w-full border-t-4 border-t-primary shadow-xl mb-4">
          <CardHeader className="text-center">
            <CardTitle className="text-primary flex items-center justify-center gap-2">
              {isSigningUp ? <UserPlus className="w-6 h-6" /> : <ShieldCheck className="w-6 h-6" />}
              {isSigningUp ? "Créer un compte" : "Administration"}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <form className="space-y-4">
              <div className="space-y-2">
                <Input type="email" placeholder="Email" value={email} onChange={(e) => setEmail(e.target.value)} required />
              </div>
              <div className="relative">
                <Input type={showPassword ? "text" : "password"} placeholder="Mot de passe" value={password} onChange={(e) => setPassword(e.target.value)} required className="pr-10" />
                <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-primary">
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
              {isSigningUp && <Input placeholder="Code de création" value={signupCodeInput} onChange={(e) => setSignupCodeInput(e.target.value)} />}
              {authError && <p className="text-xs text-destructive text-center">{authError}</p>}
              <Button onClick={(e) => handleAuth(e)} disabled={isAuthLoading} className="w-full">{isAuthLoading ? <Loader2 className="animate-spin" /> : (isSigningUp ? "S'inscrire" : "Connexion")}</Button>
              <Button type="button" variant="link" className="w-full text-xs" onClick={() => setIsSigningUp(!isSigningUp)}>{!isSigningUp ? "Pas de compte ? Créer" : "Déjà un compte ? Connecter"}</Button>
            </form>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!isAuthorized) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <Card className="max-w-md w-full border-t-4 border-t-amber-500 shadow-xl p-8 text-center space-y-6">
          <Clock className="w-16 h-16 mx-auto text-amber-600 animate-pulse" />
          <h2 className="text-xl font-bold">Accès en attente</h2>
          <Input placeholder="Code d'activation" value={inputActivationCode} onChange={(e) => setInputActivationCode(e.target.value)} />
          <Button onClick={handleUnlockWithCode} className="w-full">Valider le code</Button>
          <Button onClick={() => auth.signOut()} variant="ghost" className="w-full text-xs">Déconnexion</Button>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <ChristmasSnow />
      <div className="bg-primary text-white py-4 shadow-lg sticky top-0 z-[1000]">
        <div className="container mx-auto px-4 flex justify-between items-center">
          <div className="flex items-center gap-3">
            <img src={logoUrl} alt="Logo" className="w-10 h-10 rounded-full bg-white" />
            <h1 className="text-lg font-bold">Admin : {currentConfig?.marketYear}</h1>
          </div>
          <div className="flex gap-2">
            <Button asChild variant="secondary" size="sm" className="font-bold"><Link href="/">Site Public</Link></Button>
            <Button onClick={() => auth.signOut()} variant="ghost" size="sm" className="text-white">Quitter</Button>
          </div>
        </div>
      </div>

      <main className="container mx-auto px-4 py-8 space-y-8">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Card className="border-l-4 border-l-primary shadow-sm"><CardContent className="p-4"><p className="text-xs text-muted-foreground font-bold uppercase">Total</p><p className="text-2xl font-bold">{stats.total}</p></CardContent></Card>
          <Card className="border-l-4 border-l-amber-500 shadow-sm"><CardContent className="p-4"><p className="text-xs text-muted-foreground font-bold uppercase">À Étudier</p><p className="text-2xl font-bold">{stats.pending}</p></CardContent></Card>
          <Card className="border-l-4 border-l-green-600 shadow-sm"><CardContent className="p-4"><p className="text-xs text-muted-foreground font-bold uppercase">Confirmés</p><p className="text-2xl font-bold">{stats.validated}</p></CardContent></Card>
          <Card className="border-l-4 border-l-secondary shadow-sm"><CardContent className="p-4"><p className="text-xs text-muted-foreground font-bold uppercase">Recettes</p><p className="text-2xl font-bold">{stats.revenue}€</p></CardContent></Card>
        </div>

        <Tabs defaultValue="exhibitors">
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-6">
            <TabsList>
              <TabsTrigger value="exhibitors">Exposants</TabsTrigger>
              <TabsTrigger value="map">Carte</TabsTrigger>
              <TabsTrigger value="settings">Configuration</TabsTrigger>
              {isAuthorized && <TabsTrigger value="admins">Administrateurs</TabsTrigger>}
            </TabsList>
            
            <Select value={selectedConfigId} onValueChange={setSelectedConfigId}>
              <SelectTrigger className="w-[180px] bg-white"><SelectValue placeholder="Choisir une édition" /></SelectTrigger>
              <SelectContent>{configs?.map(c => <SelectItem key={c.id} value={c.id}>Édition {c.marketYear}</SelectItem>)}</SelectContent>
            </Select>
          </div>

          <TabsContent value="exhibitors" className="space-y-6">
            <div className="flex flex-col md:flex-row gap-4 items-center">
              <div className="relative flex-1 w-full">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input placeholder="Rechercher..." className="pl-10 bg-white" value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} />
              </div>
              <div className="flex gap-2">
                <Button onClick={() => setIsBulkEmailDialogOpen(true)} variant="outline" className="gap-2 text-secondary border-secondary/20 hover:bg-secondary/5 font-bold"><Send className="w-4 h-4" /> Message Groupé</Button>
                <Button onClick={handleExportExcel} variant="outline" className="gap-2 text-primary font-bold bg-white"><Download className="w-4 h-4" /> Export Excel</Button>
              </div>
            </div>

            <Card className="overflow-hidden border-2 bg-white">
              <Table>
                <TableHeader className="bg-muted/30">
                  <TableRow><TableHead>Exposant</TableHead><TableHead>Tables</TableHead><TableHead>Statut & Suivi</TableHead><TableHead className="text-right">Actions</TableHead></TableRow>
                </TableHeader>
                <TableBody>
                  {isExhibitorsLoading ? <TableRow><TableCell colSpan={4} className="text-center py-12"><Loader2 className="animate-spin mx-auto text-primary" /></TableCell></TableRow> :
                    filteredExhibitors.map(exhibitor => (
                      <TableRow key={exhibitor.id}>
                        <TableCell>
                          <div className="font-bold text-primary">{exhibitor.companyName}</div>
                          <div className="text-[10px] text-muted-foreground">{exhibitor.firstName} {exhibitor.lastName}</div>
                        </TableCell>
                        <TableCell><Badge variant="outline">{exhibitor.requestedTables} table(s)</Badge></TableCell>
                        <TableCell>
                          <Badge variant={getStatusVariant(exhibitor.status)}>{getStatusLabel(exhibitor.status)}</Badge>
                          {getDelayInfo(exhibitor)}
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex justify-end gap-2">
                            <Button variant="outline" size="sm" onClick={() => setViewingExhibitor(exhibitor)} title="Voir fiche"><Eye className="w-4 h-4" /></Button>
                            <Button variant="outline" size="sm" className="text-secondary border-secondary/20 hover:bg-secondary/5" onClick={() => { setActingExhibitor(exhibitor); setSingleEmailForm({ subject: '', body: '' }); setIsSingleEmailPreviewMode(false); setIsSingleEmailDialogOpen(true); }} title="Envoyer email"><Mail className="w-4 h-4" /></Button>
                            {exhibitor.status === 'pending' && (
                              <>
                                <Button size="sm" className="bg-green-600 hover:bg-green-700" onClick={() => { setActingExhibitor(exhibitor); setIsAcceptDialogOpen(true); }} title="Accepter"><CheckCircle className="w-4 h-4" /></Button>
                                <Button size="sm" variant="destructive" onClick={() => { setActingExhibitor(exhibitor); setIsRejectDialogOpen(true); }} title="Refuser"><XCircle className="w-4 h-4" /></Button>
                              </>
                            )}
                            {exhibitor.status === 'submitted_form2' && <Button size="sm" className="bg-blue-600" onClick={() => updateDocumentNonBlocking(doc(db, 'pre_registrations', exhibitor.id), { status: 'validated' })}>Valider</Button>}
                            <Button variant="ghost" size="sm" className="text-destructive hover:bg-destructive/10" onClick={() => { setActingExhibitor(exhibitor); setIsDeleteDialogOpen(true); }} title="Supprimer"><Trash2 className="w-4 h-4" /></Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                </TableBody>
              </Table>
            </Card>
          </TabsContent>

          <TabsContent value="map">
             <AdminMap exhibitors={filteredExhibitors} onViewExhibitor={setViewingExhibitor} />
          </TabsContent>

          <TabsContent value="settings" className="space-y-8">
            <Card className="max-w-3xl mx-auto border-t-4 border-t-primary bg-white shadow-xl">
              <CardHeader><CardTitle className="text-primary flex items-center gap-2"><Settings className="w-6 h-6" /> Configuration de l'édition</CardTitle></CardHeader>
              <CardContent className="space-y-6">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2"><label className="text-xs font-bold uppercase text-muted-foreground">Année</label><Input type="number" value={configForm.marketYear} onChange={(e) => setConfigForm({...configForm, marketYear: parseInt(e.target.value)})} /></div>
                  <div className="space-y-2"><label className="text-xs font-bold uppercase text-muted-foreground">Nom Édition</label><Input value={configForm.editionNumber} onChange={(e) => setConfigForm({...configForm, editionNumber: e.target.value})} /></div>
                </div>
                
                <div className="p-4 bg-primary/5 rounded-xl border-2 border-primary/10 space-y-4">
                  <div className="flex items-center gap-2 text-primary font-bold"><Mail className="w-5 h-5" /> Configuration SMTP (Gmail)</div>
                  <div className="grid md:grid-cols-2 gap-4">
                    <div className="space-y-2"><label className="text-xs font-bold uppercase text-muted-foreground">Email Expéditeur</label><Input value={configForm.smtpUser} onChange={(e) => setConfigForm({...configForm, smtpUser: e.target.value})} placeholder="votre@gmail.com" /></div>
                    <div className="space-y-2">
                      <label className="text-xs font-bold uppercase text-muted-foreground">Mot de passe d'application</label>
                      <div className="relative">
                        <Input type={showSmtpPass ? "text" : "password"} value={configForm.smtpPass} onChange={(e) => setConfigForm({...configForm, smtpPass: e.target.value})} className="pr-10" />
                        <button type="button" onClick={() => setShowSmtpPass(!showSmtpPass)} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground"><Eye className="w-4 h-4" /></button>
                      </div>
                      <a href="https://myaccount.google.com/apppasswords" target="_blank" rel="noopener noreferrer" className="text-[10px] text-blue-600 hover:underline flex items-center gap-1 mt-1"><ExternalLink className="w-2.5 h-2.5" /> Aide : Créer un mot de passe d'application</a>
                    </div>
                  </div>
                  <div className="flex gap-2 items-end border-t pt-4">
                    <div className="flex-1 space-y-1">
                      <label className="text-[10px] font-bold uppercase">Tester l'envoi vers :</label>
                      <Input placeholder="votre@email.com" value={testEmailAddress} onChange={e => setTestEmailAddress(e.target.value)} className="h-8 text-xs" />
                    </div>
                    <Button variant="outline" size="sm" onClick={() => handleSendTestEmail()} disabled={isSendingTest || !testEmailAddress} className="h-8 gap-2">{isSendingTest ? <Loader2 className="w-3 h-3 animate-spin" /> : <Send className="w-3 h-3" />} Tester SMTP</Button>
                  </div>
                </div>

                <div className="p-4 bg-primary/5 rounded-xl border-2 border-primary/10 space-y-4">
                  <div className="flex items-center gap-2 text-primary font-bold"><Key className="w-5 h-5" /> Sécurité & Accès Admin</div>
                  <div className="space-y-2"><label className="text-xs font-bold uppercase text-muted-foreground">Code d'invitation secret</label><Input value={configForm.signupCode} onChange={(e) => setConfigForm({...configForm, signupCode: e.target.value})} className="font-mono" /></div>
                </div>

                <div className="grid grid-cols-2 gap-4 border-y py-4">
                  <div className="space-y-2"><label className="text-xs font-bold uppercase text-muted-foreground">Samedi : Date</label><Input value={configForm.saturdayDate} onChange={(e) => setConfigForm({...configForm, saturdayDate: e.target.value})} /></div>
                  <div className="space-y-2"><label className="text-xs font-bold uppercase text-muted-foreground">Samedi : Heures</label><Input value={configForm.saturdayHours} onChange={(e) => setConfigForm({...configForm, saturdayHours: e.target.value})} /></div>
                  <div className="space-y-2"><label className="text-xs font-bold uppercase text-muted-foreground">Dimanche : Date</label><Input value={configForm.sundayDate} onChange={(e) => setConfigForm({...configForm, sundayDate: e.target.value})} /></div>
                  <div className="space-y-2"><label className="text-xs font-bold uppercase text-muted-foreground">Dimanche : Heures</label><Input value={configForm.sundayHours} onChange={(e) => setConfigForm({...configForm, sundayHours: e.target.value})} /></div>
                </div>
                <div className="grid grid-cols-3 gap-4">
                  <div className="space-y-2"><label className="text-xs font-bold uppercase text-muted-foreground">Prix 1 Table</label><Input type="number" value={configForm.priceTable1} onChange={(e) => setConfigForm({...configForm, priceTable1: parseInt(e.target.value)})} /></div>
                  <div className="space-y-2"><label className="text-xs font-bold uppercase text-muted-foreground">Prix 2 Tables</label><Input type="number" value={configForm.priceTable2} onChange={(e) => setConfigForm({...configForm, priceTable2: parseInt(e.target.value)})} /></div>
                  <div className="space-y-2"><label className="text-xs font-bold uppercase text-muted-foreground">Prix Repas</label><Input type="number" value={configForm.priceMeal} onChange={(e) => setConfigForm({...configForm, priceMeal: parseInt(e.target.value)})} /></div>
                </div>
                <Button onClick={() => setDocumentNonBlocking(doc(db, 'market_configurations', currentConfig!.id), { ...configForm }, { merge: true })} className="w-full">Sauvegarder la configuration</Button>
                
                <Separator />
                
                <div className="space-y-4">
                  <div className="flex justify-between items-center">
                    <h3 className="text-lg font-bold text-primary flex items-center gap-2"><Mail className="w-5 h-5" /> Templates d'Email</h3>
                    <Button onClick={() => { setEditingTemplateId(null); setTemplateForm({ name: '', subject: '', body: '' }); setIsTemplateFormVisible(true); }} size="sm" variant="outline" className="gap-2"><Plus className="w-4 h-4" /> Nouveau</Button>
                  </div>
                  <div className="grid gap-4">
                    {templates?.map(t => (
                      <div key={t.id} className="p-4 border rounded-xl flex justify-between items-center bg-muted/20">
                        <div className="space-y-1"><p className="font-bold">{t.name}</p><p className="text-xs text-muted-foreground">{t.subject}</p></div>
                        <div className="flex gap-2">
                          <Button size="sm" variant="ghost" onClick={() => { setEditingTemplateId(t.id); setTemplateForm({ name: t.name, subject: t.subject, body: t.body }); setIsTemplatePreviewMode(false); setIsTemplateFormVisible(true); }}><Settings className="w-4 h-4" /></Button>
                          <Button size="sm" variant="ghost" className="text-destructive" onClick={() => deleteDocumentNonBlocking(doc(db, 'email_templates', t.id))}><Trash2 className="w-4 h-4" /></Button>
                        </div>
                      </div>
                    ))}
                  </div>

                  {isTemplateFormVisible && (
                    <div className="p-6 border-2 border-primary/20 rounded-2xl bg-primary/5 space-y-4">
                      <div className="space-y-2"><label className="text-xs font-bold uppercase">Nom interne</label><Input value={templateForm.name} onChange={e => setTemplateForm({...templateForm, name: e.target.value})} /></div>
                      <div className="space-y-2"><label className="text-xs font-bold uppercase">Objet de l'email</label><Input value={templateForm.subject} onChange={e => setTemplateForm({...templateForm, subject: e.target.value})} /></div>
                      <div className="space-y-2">
                        <label className="text-xs font-bold uppercase">Message</label>
                        <EditorToolbar 
                          textareaRef={templateTextareaRef} 
                          setter={setTemplateForm} 
                          isPreview={isTemplatePreviewMode} 
                          onTogglePreview={() => setIsTemplatePreviewMode(!isTemplatePreviewMode)} 
                        />
                        {!isTemplatePreviewMode ? (
                          <Textarea ref={templateTextareaRef} value={templateForm.body} onChange={e => setTemplateForm({...templateForm, body: e.target.value})} rows={10} className="rounded-t-none font-mono text-xs" />
                        ) : (
                          <div className="min-h-[200px] p-4 bg-white border border-t-0 rounded-b-lg prose prose-sm max-w-none" dangerouslySetInnerHTML={{ __html: templateForm.body }} />
                        )}
                      </div>
                      <div className="flex gap-2">
                        <Button onClick={handleSaveTemplate} className="flex-1">Sauvegarder</Button>
                        <Button variant="ghost" onClick={() => setIsTemplateFormVisible(false)}>Annuler</Button>
                      </div>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {isAuthorized && (
            <TabsContent value="admins" className="space-y-6">
              <div className="grid md:grid-cols-2 gap-8">
                <Card className="border-t-4 border-t-amber-500 shadow-md">
                  <CardHeader><CardTitle className="text-lg flex items-center gap-2 text-amber-600"><Clock className="w-5 h-5" /> Demandes</CardTitle></CardHeader>
                  <CardContent className="space-y-4">
                    {adminRequests?.filter(r => r.status === 'PENDING').map(request => (
                      <div key={request.id} className="p-4 border rounded-xl flex flex-col gap-3 bg-amber-50/30">
                        <div className="flex justify-between items-start">
                          <div><p className="font-bold">{request.email}</p><p className="text-[10px] text-muted-foreground">{new Date(request.requestedAt).toLocaleDateString()}</p></div>
                          <div className="flex gap-2">
                            <Button size="sm" className="bg-green-600" onClick={() => {
                              setDocumentNonBlocking(doc(db, 'roles_admin', request.id), { addedAt: new Date().toISOString(), email: request.email, isSuperAdmin: false }, { merge: true });
                              updateDocumentNonBlocking(doc(db, 'admin_requests', request.id), { status: 'APPROVED' });
                            }}><CheckCircle className="w-4 h-4" /></Button>
                            <Button size="sm" variant="destructive" onClick={() => updateDocumentNonBlocking(doc(db, 'admin_requests', request.id), { status: 'REJECTED' })}><XCircle className="w-4 h-4" /></Button>
                          </div>
                        </div>
                        <div className="p-2 bg-white rounded border flex justify-between items-center">
                          <span className="text-xs font-bold text-muted-foreground">Code :</span>
                          <span className="text-lg font-mono font-bold text-amber-600 tracking-wider">{request.invitationCode}</span>
                        </div>
                      </div>
                    ))}
                  </CardContent>
                </Card>
                <Card className="border-t-4 border-t-primary shadow-md">
                  <CardHeader><CardTitle className="text-lg flex items-center gap-2 text-primary"><ShieldCheck className="w-5 h-5" /> Administrateurs</CardTitle></CardHeader>
                  <CardContent className="space-y-4">
                    {adminRoles?.map(admin => (
                      <div key={admin.id} className="p-4 border rounded-xl flex justify-between items-center">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold">{admin.email.charAt(0).toUpperCase()}</div>
                          <div><p className="font-bold text-sm">{admin.email}</p><p className="text-[10px] text-muted-foreground">Depuis {new Date(admin.addedAt).toLocaleDateString()}</p></div>
                        </div>
                        {admin.id !== user.uid && <Button size="sm" variant="ghost" className="text-destructive" onClick={() => deleteDocumentNonBlocking(doc(db, 'roles_admin', admin.id))}><Trash2 className="w-4 h-4" /></Button>}
                      </div>
                    ))}
                  </CardContent>
                </Card>
              </div>
            </TabsContent>
          )}
        </Tabs>
      </main>

      <Dialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <DialogContent><DialogHeader><DialogTitle>Supprimer l'exposant</DialogTitle></DialogHeader>
          <div className="py-4"><p className="text-sm">Confirmer la suppression définitive de <strong>{actingExhibitor?.companyName}</strong> ?</p></div>
          <DialogFooter><Button variant="ghost" onClick={() => setIsDeleteDialogOpen(false)}>Annuler</Button><Button variant="destructive" onClick={handleDeleteExhibitor}>Supprimer</Button></DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={isBulkEmailDialogOpen} onOpenChange={setIsBulkEmailDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader><DialogTitle className="flex items-center gap-2"><Send className="w-6 h-6" /> Message groupé</DialogTitle></DialogHeader>
          <div className="py-6 space-y-6">
            <Badge variant="secondary" className="px-4 py-2">Destinataires : {confirmedExhibitors.length} exposants validés</Badge>
            <Select value={selectedTemplateId} onValueChange={setSelectedTemplateId}>
              <SelectTrigger><SelectValue placeholder="Sélectionner un modèle..." /></SelectTrigger>
              <SelectContent>{templates?.map(t => <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>)}</SelectContent>
            </Select>
            {selectedTemplateId && (
              <div className="p-4 border rounded-xl bg-muted/20 max-h-60 overflow-y-auto">
                <p className="text-sm font-bold mb-2">Objet : {templates?.find(t => t.id === selectedTemplateId)?.subject}</p>
                <div className="text-sm prose prose-sm max-w-none" dangerouslySetInnerHTML={{ __html: templates?.find(t => t.id === selectedTemplateId)?.body || "" }} />
              </div>
            )}
          </div>
          <DialogFooter><Button variant="ghost" onClick={() => setIsBulkEmailDialogOpen(false)}>Annuler</Button><Button onClick={handleBulkEmailSend} disabled={isSending || !selectedTemplateId} className="gap-2">{isSending ? <Loader2 className="animate-spin" /> : "Envoyer"}</Button></DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={isSingleEmailDialogOpen} onOpenChange={setIsSingleEmailDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader><DialogTitle className="flex items-center gap-2"><Mail className="w-6 h-6" /> Message à {actingExhibitor?.companyName}</DialogTitle></DialogHeader>
          <div className="py-4 space-y-4">
            <Select onValueChange={(val) => { const t = templates?.find(tmp => tmp.id === val); if (t) { setSingleEmailForm({ subject: t.subject, body: t.body }); setIsSingleEmailPreviewMode(false); } }}>
              <SelectTrigger><SelectValue placeholder="Charger un modèle..." /></SelectTrigger>
              <SelectContent>{templates?.map(t => <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>)}</SelectContent>
            </Select>
            <Input value={singleEmailForm.subject} onChange={e => setSingleEmailForm({...singleEmailForm, subject: e.target.value})} placeholder="Sujet..." />
            <div className="space-y-2">
              <EditorToolbar 
                textareaRef={singleEmailTextareaRef} 
                setter={setSingleEmailForm} 
                isPreview={isSingleEmailPreviewMode} 
                onTogglePreview={() => setIsSingleEmailPreviewMode(!isSingleEmailPreviewMode)} 
                showDossierLink={true}
              />
              {!isSingleEmailPreviewMode ? (
                <Textarea ref={singleEmailTextareaRef} value={singleEmailForm.body} onChange={e => setSingleEmailForm({...singleEmailForm, body: e.target.value})} rows={10} className="rounded-t-none font-mono text-xs" />
              ) : (
                <div className="min-h-[200px] p-4 bg-white border border-t-0 rounded-b-lg prose prose-sm max-w-none" dangerouslySetInnerHTML={{ __html: singleEmailForm.body }} />
              )}
            </div>
          </div>
          <DialogFooter><Button variant="ghost" onClick={() => setIsSingleEmailDialogOpen(false)}>Annuler</Button><Button onClick={handleSingleEmailSend} disabled={isSending || !singleEmailForm.subject} className="gap-2">{isSending ? <Loader2 className="animate-spin" /> : "Envoyer"}</Button></DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!viewingExhibitor} onOpenChange={o => !o && setViewingExhibitor(null)}>
        <DialogContent className="max-w-4xl max-h-[90vh]"><DialogHeader><DialogTitle>Fiche : {viewingExhibitor?.companyName}</DialogTitle></DialogHeader>
          <ScrollArea className="h-[75vh] pr-4">
             {viewingExhibitor && (
               <div className="space-y-8 p-4">
                 <section className="space-y-4">
                   <h3 className="text-lg font-bold border-b pb-2 flex items-center gap-2 text-primary"><FileText className="w-5 h-5" /> Informations (Formulaire 1)</h3>
                   <div className="grid md:grid-cols-2 gap-6">
                     <div className="space-y-2"><p className="text-xs font-bold uppercase">Identité</p><p className="font-semibold">{viewingExhibitor.firstName} {viewingExhibitor.lastName}</p><p className="text-sm">{viewingExhibitor.email}</p><p className="text-sm">{viewingExhibitor.phone}</p><p className="text-sm">{viewingExhibitor.websiteUrl}</p></div>
                     <div className="space-y-2"><p className="text-xs font-bold uppercase">Adresse</p><p className="text-sm">{viewingExhibitor.address}</p><p className="text-sm">{viewingExhibitor.postalCode} {viewingExhibitor.city}</p></div>
                   </div>
                   <div className="grid md:grid-cols-2 gap-6"><Badge variant="outline">{viewingExhibitor.isRegistered ? "Pro" : "Particulier"}</Badge><Badge className="bg-primary">{viewingExhibitor.requestedTables} table(s)</Badge></div>
                   <p className="text-sm bg-muted/30 p-3 rounded-lg border">{viewingExhibitor.productDescription}</p>
                   {viewingExhibitor.productImages && <div className="grid grid-cols-3 gap-4">{viewingExhibitor.productImages.map((img, i) => <img key={i} src={img} className="rounded border aspect-square object-cover" />)}</div>}
                 </section>
                 {viewingExhibitor.detailedInfo ? (
                   <section className="space-y-6 pt-4 border-t-2">
                     <h3 className="text-lg font-bold border-b pb-2 flex items-center gap-2 text-secondary"><ShieldCheck className="w-5 h-5" /> Dossier Technique (Formulaire 2)</h3>
                     <div className="grid md:grid-cols-2 gap-6">
                       <div className="space-y-4"><p className="text-sm">SIRET: {viewingExhibitor.detailedInfo.siret || "---"}</p>{viewingExhibitor.detailedInfo.idCardPhoto && <img src={viewingExhibitor.detailedInfo.idCardPhoto} className="rounded border max-w-full h-40 object-contain" />}</div>
                       <div className="space-y-4">
                         <div className="flex flex-wrap gap-2">{viewingExhibitor.detailedInfo.needsElectricity ? <Badge className="bg-amber-500">Électricité</Badge> : <Badge variant="outline">Pas d'élec</Badge>}{viewingExhibitor.detailedInfo.needsGrid && <Badge className="bg-blue-500">Grille</Badge>}</div>
                         <p className="text-sm font-bold">{viewingExhibitor.detailedInfo.sundayLunchCount || 0} repas</p>
                       </div>
                     </div>
                     <div className="p-4 bg-muted/20 rounded-xl border grid md:grid-cols-2 gap-6">
                        <div><p className="text-xs font-bold uppercase">Assurance</p><p className="text-sm">{viewingExhibitor.detailedInfo.insuranceCompany}</p><p className="text-sm">{viewingExhibitor.detailedInfo.insurancePolicyNumber}</p></div>
                        <div><p className="text-xs font-bold uppercase">Tombola</p>{viewingExhibitor.detailedInfo.tombolaLot ? <p className="text-xs">{viewingExhibitor.detailedInfo.tombolaLotDescription}</p> : "Non"}</div>
                     </div>
                     <p className="text-sm italic">{viewingExhibitor.detailedInfo.additionalComments}</p>
                     <div className="p-6 bg-primary text-white rounded-2xl shadow-lg space-y-4">
                        <h3 className="text-lg font-bold border-b border-white/20 pb-3"><Calculator className="w-5 h-5" /> Récapitulatif</h3>
                        <div className="space-y-2 text-sm opacity-90">
                          <div className="flex justify-between"><span>Emplacement ({viewingExhibitor.requestedTables === '1' ? '1.75m' : '3.50m'}) :</span><span>{viewingExhibitor.requestedTables === '1' ? (currentConfig?.priceTable1 ?? 40) : (currentConfig?.priceTable2 ?? 60)} €</span></div>
                          {viewingExhibitor.detailedInfo.needsElectricity && <div className="flex justify-between"><span>Option Électricité :</span><span>{currentConfig?.priceElectricity ?? 1} €</span></div>}
                          {(viewingExhibitor.detailedInfo.sundayLunchCount || 0) > 0 && <div className="flex justify-between"><span>Repas ({viewingExhibitor.detailedInfo.sundayLunchCount} x {currentConfig?.priceMeal ?? 8}€) :</span><span>{(viewingExhibitor.detailedInfo.sundayLunchCount || 0) * (currentConfig?.priceMeal ?? 8)} €</span></div>}
                        </div>
                        <div className="flex justify-between items-center text-xl font-bold border-t border-white/20 pt-3"><span>TOTAL :</span><span className="text-3xl text-accent">
                            {(() => {
                              const stand = viewingExhibitor.requestedTables === '1' ? (currentConfig?.priceTable1 ?? 40) : (currentConfig?.priceTable2 ?? 60);
                              const elec = viewingExhibitor.detailedInfo!.needsElectricity ? (currentConfig?.priceElectricity ?? 1) : 0;
                              const meals = (viewingExhibitor.detailedInfo!.sundayLunchCount || 0) * (currentConfig?.priceMeal ?? 8);
                              return stand + elec + meals;
                            })()} €
                        </span></div>
                     </div>
                   </section>
                 ) : <div className="p-8 border-2 border-dashed rounded-2xl text-center text-muted-foreground"><Clock className="w-10 h-10 mx-auto mb-3 opacity-20" /><p>Dossier technique non encore soumis</p></div>}
               </div>
             )}
          </ScrollArea>
        </DialogContent>
      </Dialog>
      
      <Dialog open={isAcceptDialogOpen} onOpenChange={setIsAcceptDialogOpen}>
        <DialogContent><DialogHeader><DialogTitle>Accepter {actingExhibitor?.companyName}</DialogTitle></DialogHeader>
          <div className="space-y-4 mt-4"><p className="text-sm">Enverra un e-mail avec le lien vers le dossier technique.</p><Textarea placeholder="Mot personnel..." value={acceptanceMessage} onChange={e => setAcceptanceMessage(e.target.value)} rows={4} /></div>
          <DialogFooter className="mt-6"><Button variant="ghost" onClick={() => setIsAcceptDialogOpen(false)}>Annuler</Button><Button onClick={async () => { if (!actingExhibitor) return; setIsSending(true); updateDocumentNonBlocking(doc(db, 'pre_registrations', actingExhibitor.id), { status: 'accepted_form1', acceptedAt: new Date().toISOString() }); await sendAcceptanceEmail(actingExhibitor, acceptanceMessage, currentConfig); setIsAcceptDialogOpen(false); setIsSending(false); setAcceptanceMessage(''); toast({ title: "Accepté et email envoyé" }); }} disabled={isSending}>{isSending ? <Loader2 className="animate-spin" /> : "Confirmer"}</Button></DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={isRejectDialogOpen} onOpenChange={setIsRejectDialogOpen}>
        <DialogContent><DialogHeader><DialogTitle>Refuser la candidature</DialogTitle></DialogHeader>
          <div className="space-y-4 mt-4"><Button variant="outline" size="sm" onClick={async () => { if (!actingExhibitor) return; setIsSending(true); const res = await generateRejectionJustification({ applicantName: `${actingExhibitor.firstName} ${actingExhibitor.lastName}`, applicationSummary: actingExhibitor.productDescription, rejectionReasons: ["Manque de place"] }); setJustification(res.justificationMessage); setIsSending(false); }} disabled={isSending} className="gap-2"><Sparkles className="w-4 h-4" /> IA</Button><Textarea value={justification} onChange={e => setJustification(e.target.value)} placeholder="Motif..." rows={6} /></div>
          <DialogFooter className="mt-6"><Button variant="ghost" onClick={() => setIsRejectDialogOpen(false)}>Annuler</Button><Button variant="destructive" onClick={async () => { if (!actingExhibitor) return; setIsSending(true); updateDocumentNonBlocking(doc(db, 'pre_registrations', actingExhibitor.id), { status: 'rejected', rejectionJustification: justification }); await sendRejectionEmail(actingExhibitor, justification, currentConfig); setIsRejectDialogOpen(false); setIsSending(false); setJustification(''); toast({ title: "Refusé" }); }} disabled={isSending || !justification}>Confirmer</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
