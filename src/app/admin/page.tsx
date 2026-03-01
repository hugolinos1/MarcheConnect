
"use client"
import React, { useEffect, useState, useMemo, useRef } from 'react';
import dynamic from 'next/dynamic';
import { Exhibitor, ApplicationStatus } from '@/lib/types';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ChristmasSnow } from '@/components/ChristmasSnow';
import { CheckCircle, XCircle, Search, Mail, Loader2, Trash2, Eye, ShieldCheck, Sparkles, Download, Settings, Clock, ArrowLeft, Key, UserPlus, EyeOff, Plus, Send, Type, WrapText, Bold, Italic, Underline, Link as LucideLink, Image as ImageIcon, Zap, Utensils, Gift, Calculator, MessageSquare, FileText, X as XIcon, Map as MapIcon, Lock, ExternalLink, AlertTriangle, Link2, Star, TrendingUp, CreditCard, Shield, LayoutGrid, Pencil } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import Link from 'next/link';
import { sendAcceptanceEmail, sendRejectionEmail, sendBulkEmailAction, sendTestEmailAction, sendCustomIndividualEmail } from '@/app/actions/email-actions';
import { useToast } from '@/hooks/use-toast';
import { useFirestore, useMemoFirebase, useCollection, useUser, useAuth, useDoc } from '@/firebase';
import { collection, doc, query, orderBy, where } from 'firebase/firestore';
import { updateDocumentNonBlocking, setDocumentNonBlocking, deleteDocumentNonBlocking, addDocumentNonBlocking } from '@/firebase/non-blocking-updates';
import { initiateEmailSignIn, initiateEmailSignUp } from '@/firebase/non-blocking-login';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
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
  const freeBulkEmailRef = useRef<HTMLTextAreaElement>(null);
  const individualEmailRef = useRef<HTMLTextAreaElement>(null);
  
  const [searchTerm, setSearchTerm] = useState('');
  const [isAuthLoading, setIsAuthLoading] = useState(false);
  const [isSigningUp, setIsSigningUp] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [isSendingTest, setIsSendingTest] = useState(false);
  const [justification, setJustification] = useState('');
  const [acceptanceMessage, setAcceptanceMessage] = useState('');
  const [selectedConfigId, setSelectedConfigId] = useState<string>('');
  const [viewingExhibitor, setViewingExhibitor] = useState<Exhibitor | null>(null);
  
  const [isAcceptDialogOpen, setIsAcceptDialogOpen] = useState(false);
  const [isRejectDialogOpen, setIsRejectDialogOpen] = useState(false);
  const [isBulkEmailDialogOpen, setIsBulkEmailDialogOpen] = useState(false);
  const [isIndividualEmailDialogOpen, setIsIndividualEmailDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [actingExhibitor, setActingExhibitor] = useState<Exhibitor | null>(null);
  
  const [bulkEmailMode, setBulkEmailMode] = useState<'template' | 'free'>('template');
  const [individualEmailMode, setIndividualEmailMode] = useState<'template' | 'free'>('template');
  const [selectedTemplateId, setSelectedTemplateId] = useState<string>('');
  const [freeBulkEmail, setFreeBulkEmail] = useState({ subject: '', body: '' });
  const [individualEmail, setIndividualEmail] = useState({ subject: '', body: '' });
  const [includeDossierLink, setIncludeDossierLink] = useState(false);
  const [isFreeEmailPreview, setIsFreeEmailPreview] = useState(false);
  const [isIndividualEmailPreview, setIsIndividualEmailPreview] = useState(false);
  const [isTemplatePreviewMode, setIsTemplatePreviewMode] = useState(false);
  const [isTemplateFormVisible, setIsTemplateFormVisible] = useState(false);
  
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showAuthPass, setShowAuthPass] = useState(false);
  const [showSmtpPass, setShowSmtpPass] = useState(false);
  const [signupCodeInput, setSignupCodeInput] = useState('');
  const [authError, setAuthError] = useState('');
  const [testEmailAddress, setTestEmailAddress] = useState('');

  // Editing state
  const [editFormData, setEditFormData] = useState({
    firstName: '',
    lastName: '',
    companyName: '',
    email: '',
    phone: '',
    requestedTables: '1' as '1' | '2',
    sundayLunchCount: 0,
    needsElectricity: false,
    needsGrid: false
  });

  const logoUrl = "https://i.ibb.co/yncRPkvR/logo-ujpf.jpg";
  
  const userRoleRef = useMemoFirebase(() => user ? doc(db, 'roles_admin', user.uid) : null, [db, user]);
  const { data: userRoleDoc, isLoading: isRoleLoading } = useDoc(userRoleRef);
  
  const isMasterAdmin = user?.email === "hugues.rabier@gmail.com";
  const isSuperAdmin = isMasterAdmin || !!userRoleDoc?.isSuperAdmin;
  const isAuthorized = isSuperAdmin || !!userRoleDoc;

  const marketConfigsQuery = useMemoFirebase(() => query(collection(db, 'market_configurations'), orderBy('marketYear', 'desc')), [db]);
  const { data: configs } = useCollection(marketConfigsQuery);
  
  const currentConfig = useMemo(() => {
    if (!configs || configs.length === 0) return null;
    return configs.find(c => c.id === selectedConfigId) || configs.find(c => c.currentMarket) || configs[0];
  }, [configs, selectedConfigId]);

  useEffect(() => {
    if (currentConfig && !selectedConfigId) {
      setSelectedConfigId(currentConfig.id);
    }
  }, [currentConfig, selectedConfigId]);

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
    const filtered = exhibitorsData.filter(e => 
      e.companyName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      `${e.firstName} ${e.lastName}`.toLowerCase().includes(searchTerm.toLowerCase())
    );
    return [...filtered].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }, [exhibitorsData, searchTerm]);

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
        posterImageUrl: currentConfig.posterImageUrl || "https://i.ibb.co/3y3KRNW4/Affiche-March.jpg",
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
    const testBody = body || templateForm.body || "<p>Ceci est un email de test.</p>";
    if (!testEmailAddress) return;
    setIsSendingTest(true);
    const res = await sendTestEmailAction(testEmailAddress, testSubject, testBody, configForm);
    if (res.success) toast({ title: "Email de test envoyé !" });
    else toast({ variant: "destructive", title: "Erreur", description: res.error });
    setIsSendingTest(false);
  };

  const handleIndividualEmailSend = async () => {
    if (!actingExhibitor) return;
    let subject = '';
    let body = '';
    
    if (individualEmailMode === 'template') {
      const template = templates?.find(t => t.id === selectedTemplateId);
      if (!template) return;
      subject = template.subject;
      body = template.body;
    } else {
      if (!individualEmail.subject || !individualEmail.body) return;
      subject = individualEmail.subject;
      body = individualEmail.body;
    }

    setIsSending(true);
    const res = await sendCustomIndividualEmail(actingExhibitor, subject, body, includeDossierLink, configForm);
    if (res.success) toast({ title: "Email envoyé à " + actingExhibitor.companyName });
    else toast({ variant: "destructive", title: "Erreur", description: res.error });
    
    setIsIndividualEmailDialogOpen(false);
    setIsSending(false);
    setIndividualEmail({ subject: '', body: '' });
    setIncludeDossierLink(false);
    setSelectedTemplateId('');
  };

  const handleBulkEmailSend = async () => {
    let subject = '';
    let body = '';
    
    if (bulkEmailMode === 'template') {
      const template = templates?.find(t => t.id === selectedTemplateId);
      if (!template) return;
      subject = template.subject;
      body = template.body;
    } else {
      if (!freeBulkEmail.subject || !freeBulkEmail.body) return;
      subject = freeBulkEmail.subject;
      body = freeBulkEmail.body;
    }

    const confirmedExhibitors = filteredExhibitors.filter(e => e.status === 'validated' || e.status === 'submitted_form2');
    if (confirmedExhibitors.length === 0) return;
    
    setIsSending(true);
    const emails = confirmedExhibitors.map(e => e.email);
    const res = await sendBulkEmailAction(emails, subject, body, configForm);
    if (res.success) toast({ title: "Emails envoyés !" });
    setIsBulkEmailDialogOpen(false);
    setIsSending(false);
    setFreeBulkEmail({ subject: '', body: '' });
    setSelectedTemplateId('');
  };

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError('');
    setIsAuthLoading(true);
    try {
      if (isSigningUp) {
        const userCred = await initiateEmailSignUp(auth, email, password);
        const uid = userCred.user.uid;
        const masterCode = currentConfig?.signupCode || "FELIX2026";
        if (signupCodeInput === masterCode) {
          if (email === "hugues.rabier@gmail.com") {
            setDocumentNonBlocking(doc(db, 'roles_admin', uid), { addedAt: new Date().toISOString(), email: email, isSuperAdmin: true }, { merge: true });
          } else {
            setDocumentNonBlocking(doc(db, 'admin_requests', uid), { email, requestedAt: new Date().toISOString(), status: 'PENDING', invitationCode: Math.floor(100000 + Math.random() * 900000).toString() }, { merge: true });
          }
        } else setAuthError("Code invalide");
      } else {
        await initiateEmailSignIn(auth, email, password);
      }
    } catch (err: any) {
      setAuthError(err.message);
    } finally {
      setIsAuthLoading(false);
    }
  };

  const handleOpenEdit = (ex: Exhibitor) => {
    setActingExhibitor(ex);
    setEditFormData({
      firstName: ex.firstName || '',
      lastName: ex.lastName || '',
      companyName: ex.companyName || '',
      email: ex.email || '',
      phone: ex.phone || '',
      requestedTables: ex.requestedTables || '1',
      sundayLunchCount: ex.detailedInfo?.sundayLunchCount || 0,
      needsElectricity: ex.detailedInfo?.needsElectricity || false,
      needsGrid: ex.detailedInfo?.needsGrid || false
    });
    setIsEditDialogOpen(true);
  };

  const handleEditSave = () => {
    if (!actingExhibitor) return;
    
    const updates: any = {
      firstName: editFormData.firstName,
      lastName: editFormData.lastName,
      companyName: editFormData.companyName,
      email: editFormData.email,
      phone: editFormData.phone,
      requestedTables: editFormData.requestedTables
    };

    if (actingExhibitor.detailedInfo) {
      updates.detailedInfo = {
        ...actingExhibitor.detailedInfo,
        sundayLunchCount: editFormData.sundayLunchCount,
        needsElectricity: editFormData.needsElectricity,
        needsGrid: editFormData.needsGrid
      };
    }

    updateDocumentNonBlocking(doc(db, 'pre_registrations', actingExhibitor.id), updates);
    setIsEditDialogOpen(false);
    toast({ title: "Fiche mise à jour avec succès" });
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
    const newText = closeTag ? `${before}<${tag}>${selected}</${closeTag || tag}>${after}` : `${before}<${tag}/>${after}`;
    setter((prev: any) => ({ ...prev, body: newText }));
  };

  const EditorToolbar = ({ textareaRef, setter, isPreview, onTogglePreview }: any) => (
    <div className="flex flex-wrap items-center justify-between gap-2 p-2 bg-muted rounded-t-lg border-x border-t">
      <div className="flex flex-wrap gap-1">
        <Button variant="ghost" type="button" size="sm" className="h-8 w-8 p-0" onClick={() => insertTag(textareaRef, 'b', setter, 'b')}><Bold className="w-4 h-4" /></Button>
        <Button variant="ghost" type="button" size="sm" className="h-8 w-8 p-0" onClick={() => insertTag(textareaRef, 'i', setter, 'i')}><Italic className="w-4 h-4" /></Button>
        <Button variant="ghost" type="button" size="sm" className="h-8 w-8 p-0" onClick={() => insertTag(textareaRef, 'u', setter, 'u')}><Underline className="w-4 h-4" /></Button>
        <Separator orientation="vertical" className="h-6 mx-1" />
        <Button variant="ghost" type="button" size="sm" className="h-8 w-8 p-0" onClick={() => insertTag(textareaRef, 'p', setter, 'p')}><Type className="w-4 h-4" /></Button>
        <Button variant="ghost" type="button" size="sm" className="h-8 w-8 p-0" onClick={() => insertTag(textareaRef, 'br', setter)}><WrapText className="w-4 h-4" /></Button>
      </div>
      <Button variant="secondary" type="button" size="sm" onClick={onTogglePreview} className="h-8 px-2 text-[10px]">{isPreview ? "Rédiger" : "Aperçu"}</Button>
    </div>
  );

  const getExhibitorDelay = (ex: Exhibitor) => {
    const now = new Date();
    if (ex.status === 'accepted_form1' && ex.acceptedAt) {
      const days = differenceInDays(now, new Date(ex.acceptedAt));
      return { days, label: "Attente Dossier", color: days > 15 ? "text-amber-600 font-bold" : "" };
    }
    if (ex.status === 'submitted_form2' && ex.detailedInfo?.submittedAt) {
      const days = differenceInDays(now, new Date(ex.detailedInfo.submittedAt));
      return { days, label: "Attente Paiement", color: days > 15 ? "text-amber-600 font-bold" : "" };
    }
    return null;
  };

  if (isUserLoading || isRoleLoading) return <div className="min-h-screen flex items-center justify-center"><Loader2 className="animate-spin text-primary" /></div>;

  if (!user) {
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center p-4">
        <Card className="max-w-md w-full border-t-4 border-t-primary shadow-xl">
          <CardHeader className="text-center">
            <CardTitle className="text-primary flex items-center justify-center gap-2">
              <ShieldCheck className="w-6 h-6" /> {isSigningUp ? "Création Compte" : "Admin"}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleAuth} className="space-y-4">
              <Input type="email" placeholder="Email" value={email} onChange={(e) => setEmail(e.target.value)} required />
              <div className="relative">
                <Input 
                  type={showAuthPass ? "text" : "password"} 
                  placeholder="Mot de passe" 
                  value={password} 
                  onChange={(e) => setPassword(e.target.value)} 
                  required 
                  className="pr-10"
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="absolute right-0 top-0 h-full px-3 py-2 hover:bg-transparent"
                  onClick={() => setShowAuthPass(!showAuthPass)}
                >
                  {showAuthPass ? <EyeOff className="h-4 w-4 text-muted-foreground" /> : <Eye className="h-4 w-4 text-muted-foreground" />}
                </Button>
              </div>
              {isSigningUp && <Input placeholder="Code de création" value={signupCodeInput} onChange={(e) => setSignupCodeInput(e.target.value)} />}
              {authError && <p className="text-xs text-destructive text-center">{authError}</p>}
              <Button type="submit" disabled={isAuthLoading} className="w-full">{isAuthLoading ? <Loader2 className="animate-spin" /> : (isSigningUp ? "S'inscrire" : "Connexion")}</Button>
              <Button type="button" variant="link" className="w-full text-xs" onClick={() => setIsSigningUp(!isSigningUp)}>{!isSigningUp ? "Créer un compte" : "Se connecter"}</Button>
            </form>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!isAuthorized) {
    return <div className="min-h-screen flex items-center justify-center p-4 text-center"><Card className="p-8 max-w-sm"><Clock className="w-12 h-12 mx-auto text-amber-500 mb-4" /><h2 className="font-bold">Accès en attente de validation</h2><Button onClick={() => auth.signOut()} variant="ghost" className="mt-4">Déconnexion</Button></Card></div>;
  }

  return (
    <div className="min-h-screen bg-background">
      <ChristmasSnow />
      <header className="bg-primary text-white py-4 shadow-lg sticky top-0 z-[1000]">
        <div className="container mx-auto px-4 flex justify-between items-center">
          <div className="flex items-center gap-3">
            <img src={logoUrl} alt="Logo" className="w-10 h-10 rounded-full bg-white" />
            <h1 className="text-lg font-bold">Admin {currentConfig?.marketYear}</h1>
          </div>
          <div className="flex gap-2">
            <Button asChild variant="secondary" size="sm"><Link href="/">Site</Link></Button>
            <Button onClick={() => auth.signOut()} variant="ghost" size="sm">Quitter</Button>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8 space-y-8">
        {!currentConfig && (
          <Card className="border-t-4 border-t-amber-500 p-8 text-center bg-amber-50">
            <h2 className="text-xl font-bold mb-4">Aucune édition configurée</h2>
            <Button onClick={() => addDocumentNonBlocking(collection(db, 'market_configurations'), { marketYear: 2026, editionNumber: "6ème", currentMarket: true, posterImageUrl: "https://i.ibb.co/3y3KRNW4/Affiche-March.jpg" })}>Initialiser l'édition 2026</Button>
          </Card>
        )}

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Card className="border-l-4 border-l-primary"><CardContent className="p-4"><p className="text-xs text-muted-foreground font-bold">Total</p><p className="text-2xl font-bold">{stats.total}</p></CardContent></Card>
          <Card className="border-l-4 border-l-amber-500"><CardContent className="p-4"><p className="text-xs text-muted-foreground font-bold">À Étudier</p><p className="text-2xl font-bold">{stats.pending}</p></CardContent></Card>
          <Card className="border-l-4 border-l-green-600"><CardContent className="p-4"><p className="text-xs text-muted-foreground font-bold">Confirmés</p><p className="text-2xl font-bold">{stats.validated}</p></CardContent></Card>
          <Card className="border-l-4 border-l-secondary"><CardContent className="p-4"><p className="text-xs text-muted-foreground font-bold">Recettes</p><p className="text-2xl font-bold">{stats.revenue}€</p></CardContent></Card>
        </div>

        <Tabs defaultValue="exhibitors">
          <TabsList className="mb-6">
            <TabsTrigger value="exhibitors">Exposants</TabsTrigger>
            <TabsTrigger value="map">Carte</TabsTrigger>
            <TabsTrigger value="settings">Configuration</TabsTrigger>
            <TabsTrigger value="admins">Administrateurs</TabsTrigger>
          </TabsList>

          <TabsContent value="exhibitors" className="space-y-6">
            <div className="flex flex-col md:flex-row gap-4 items-center">
              <Input placeholder="Rechercher..." className="bg-white flex-1" value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} />
              <div className="flex gap-2">
                <Button onClick={() => setIsBulkEmailDialogOpen(true)} variant="outline" className="gap-2 text-secondary font-bold"><Send className="w-4 h-4" /> Message Groupé</Button>
                <Button onClick={() => {
                  const exportData = filteredExhibitors.map(e => ({
                    "Enseigne": e.companyName,
                    "Nom": e.lastName,
                    "Prénom": e.firstName,
                    "Email": e.email,
                    "Téléphone": e.phone,
                    "Statut": getStatusLabel(e.status),
                    "Date Inscription": new Date(e.createdAt).toLocaleDateString(),
                    "Type": e.isRegistered ? "Professionnel" : "Particulier",
                    "Adresse": e.address,
                    "Ville": e.city,
                    "CP": e.postalCode,
                    "Tables": e.requestedTables,
                    "Description Produits": e.productDescription,
                    "Site/Réseaux": e.websiteUrl || "",
                    // Form 2 Info
                    "SIRET": e.detailedInfo?.siret || "",
                    "Electricité": e.detailedInfo?.needsElectricity ? "OUI" : "NON",
                    "Grille": e.detailedInfo?.needsGrid ? "OUI" : "NON",
                    "Repas Dimanche": e.detailedInfo?.sundayLunchCount || 0,
                    "Tombola Lot": e.detailedInfo?.tombolaLot ? "OUI" : "NON",
                    "Description Lot": e.detailedInfo?.tombolaLotDescription || "",
                    "Cie Assurance": e.detailedInfo?.insuranceCompany || "",
                    "Police Assurance": e.detailedInfo?.insurancePolicyNumber || "",
                    "Droits Image": e.detailedInfo?.agreedToImageRights ? "OUI" : "NON",
                    "Règlement Accepté": e.detailedInfo?.agreedToTerms ? "OUI" : "NON",
                    "Commentaires": e.detailedInfo?.additionalComments || "",
                    "Date Dossier Tech": e.detailedInfo?.submittedAt ? new Date(e.detailedInfo.submittedAt).toLocaleDateString() : ""
                  }));
                  const ws = XLSX.utils.json_to_sheet(exportData);
                  const wb = XLSX.utils.book_new();
                  XLSX.utils.book_append_sheet(wb, ws, "Exposants");
                  XLSX.writeFile(wb, `Exposants_Complets_${currentConfig?.marketYear}.xlsx`);
                }} variant="outline" className="gap-2 font-bold"><Download className="w-4 h-4" /> Export Excel</Button>
              </div>
            </div>

            <Card className="overflow-hidden">
              <Table>
                <TableHeader className="bg-muted/30">
                  <TableRow>
                    <TableHead>Exposant</TableHead>
                    <TableHead>Tables</TableHead>
                    <TableHead>Statut & Suivi</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {isExhibitorsLoading ? <TableRow><TableCell colSpan={4} className="text-center py-12"><Loader2 className="animate-spin mx-auto text-primary" /></TableCell></TableRow> :
                    filteredExhibitors.map(ex => {
                      const delay = getExhibitorDelay(ex);
                      return (
                        <TableRow key={ex.id}>
                          <TableCell><div className="font-bold">{ex.companyName}</div><div className="text-[10px] text-muted-foreground">{ex.firstName} {ex.lastName}</div></TableCell>
                          <TableCell><Badge variant="outline">{ex.requestedTables}</Badge></TableCell>
                          <TableCell>
                            <div className="flex flex-col gap-1.5 items-start">
                              <Badge variant={getStatusVariant(ex.status)}>{getStatusLabel(ex.status)}</Badge>
                              {delay && (
                                <div className={`text-[10px] flex items-center gap-1 ${delay.color}`}>
                                  {delay.days > 15 && <AlertTriangle className="w-3 h-3" />}
                                  <span>{delay.label} : <strong>{delay.days}j</strong></span>
                                </div>
                              )}
                            </div>
                          </TableCell>
                          <TableCell className="text-right">
                            <div className="flex justify-end gap-2">
                              <Button variant="outline" size="sm" title="Email" onClick={() => { setActingExhibitor(ex); setIsIndividualEmailDialogOpen(true); }} className="text-primary border-primary/20"><Mail className="w-4 h-4" /></Button>
                              <Button variant="outline" size="sm" title="Modifier" onClick={() => handleOpenEdit(ex)} className="text-secondary border-secondary/20"><Pencil className="w-4 h-4" /></Button>
                              <Button variant="outline" size="sm" title="Voir" onClick={() => setViewingExhibitor(ex)}><Eye className="w-4 h-4" /></Button>
                              {ex.status === 'pending' && (
                                <>
                                  <Button size="sm" className="bg-green-600" title="Accepter" onClick={() => { setActingExhibitor(ex); setIsAcceptDialogOpen(true); }}><CheckCircle className="w-4 h-4" /></Button>
                                  <Button size="sm" variant="destructive" title="Refuser" onClick={() => { setActingExhibitor(ex); setIsRejectDialogOpen(true); }}><XCircle className="w-4 h-4" /></Button>
                                </>
                              )}
                              <Button variant="ghost" size="sm" className="text-destructive" title="Supprimer" onClick={() => { if(confirm("Supprimer cet exposant ?")) deleteDocumentNonBlocking(doc(db, 'pre_registrations', ex.id)); }}><Trash2 className="w-4 h-4" /></Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                </TableBody>
              </Table>
            </Card>
          </TabsContent>

          <TabsContent value="map" className="space-y-6">
            <Card className="p-4">
              <AdminMap exhibitors={exhibitorsData || []} onViewExhibitor={setViewingExhibitor} />
            </Card>
          </TabsContent>

          <TabsContent value="settings" className="space-y-8">
            <Card className="max-w-4xl mx-auto shadow-xl">
              <CardHeader className="border-b"><CardTitle className="text-primary flex items-center gap-2"><Settings className="w-6 h-6" /> Configuration de l'édition</CardTitle></CardHeader>
              <CardContent className="p-8 space-y-10">
                <div className="space-y-6">
                  <h3 className="text-sm font-bold uppercase text-muted-foreground flex items-center gap-2 border-b pb-2"><Star className="w-4 h-4" /> Édition & Visuels</h3>
                  <div className="grid md:grid-cols-2 gap-4">
                    <div className="space-y-2"><label className="text-xs font-bold">Année</label><Input type="number" value={configForm.marketYear} onChange={(e) => setConfigForm({...configForm, marketYear: parseInt(e.target.value)})} /></div>
                    <div className="space-y-2"><label className="text-xs font-bold">Nom Édition</label><Input value={configForm.editionNumber} onChange={(e) => setConfigForm({...configForm, editionNumber: e.target.value})} /></div>
                    <div className="space-y-2 md:col-span-2"><label className="text-xs font-bold">URL Affiche</label><Input value={configForm.posterImageUrl} onChange={(e) => setConfigForm({...configForm, posterImageUrl: e.target.value})} /></div>
                  </div>
                </div>

                <div className="space-y-6">
                  <h3 className="text-sm font-bold uppercase text-muted-foreground border-b pb-2">Prix & Options</h3>
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                    <div className="space-y-2"><label className="text-xs font-bold">1 Table</label><Input type="number" value={configForm.priceTable1} onChange={(e) => setConfigForm({...configForm, priceTable1: parseInt(e.target.value)})} /></div>
                    <div className="space-y-2"><label className="text-xs font-bold">2 Tables</label><Input type="number" value={configForm.priceTable2} onChange={(e) => setConfigForm({...configForm, priceTable2: parseInt(e.target.value)})} /></div>
                    <div className="space-y-2"><label className="text-xs font-bold">Repas</label><Input type="number" value={configForm.priceMeal} onChange={(e) => setConfigForm({...configForm, priceMeal: parseInt(e.target.value)})} /></div>
                    <div className="space-y-2"><label className="text-xs font-bold">Électricité</label><Input type="number" value={configForm.priceElectricity} onChange={(e) => setConfigForm({...configForm, priceElectricity: parseInt(e.target.value)})} /></div>
                    <div className="space-y-2"><label className="text-xs font-bold">Tombola</label><Input type="number" value={configForm.priceTombola} onChange={(e) => setConfigForm({...configForm, priceTombola: parseInt(e.target.value)})} /></div>
                  </div>
                </div>

                <div className="grid md:grid-cols-2 gap-8">
                  <div className="p-4 bg-primary/5 rounded-xl space-y-4 border border-primary/10">
                    <h3 className="text-sm font-bold uppercase text-primary flex items-center gap-2"><Mail className="w-4 h-4" /> Configuration SMTP (Gmail)</h3>
                    <div className="space-y-3">
                      <Input placeholder="Email Gmail" value={configForm.smtpUser} onChange={(e) => setConfigForm({...configForm, smtpUser: e.target.value})} />
                      <div className="relative">
                        <Input 
                          type={showSmtpPass ? "text" : "password"} 
                          placeholder="Mot de passe application" 
                          value={configForm.smtpPass} 
                          onChange={(e) => setConfigForm({...configForm, smtpPass: e.target.value})} 
                          className="pr-10"
                        />
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          className="absolute right-0 top-0 h-full px-3 py-2 hover:bg-transparent"
                          onClick={() => setShowSmtpPass(!showSmtpPass)}
                        >
                          {showSmtpPass ? <EyeOff className="h-4 w-4 text-muted-foreground" /> : <Eye className="h-4 w-4 text-muted-foreground" />}
                        </Button>
                      </div>
                      <div className="pt-2 border-t space-y-2">
                        <label className="text-[10px] font-bold text-muted-foreground uppercase">Email de destination du test</label>
                        <Input placeholder="votre-email@exemple.com" value={testEmailAddress} onChange={(e) => setTestEmailAddress(e.target.value)} className="h-8 text-xs" />
                        <Button variant="outline" size="sm" className="w-full text-[10px]" onClick={() => {
                          if(!testEmailAddress) {
                            toast({ variant: "destructive", title: "Champ requis", description: "Veuillez saisir un email pour le test." });
                            return;
                          }
                          handleSendTestEmail();
                        }} disabled={isSendingTest}>
                          {isSendingTest ? <Loader2 className="w-3 h-3 animate-spin mr-1" /> : <Send className="w-3 h-3 mr-1" />}
                          Envoyer l'email de test
                        </Button>
                      </div>
                    </div>
                  </div>
                  <div className="p-4 bg-muted/30 rounded-xl space-y-4 border">
                    <h3 className="text-sm font-bold uppercase text-muted-foreground flex items-center gap-2"><Key className="w-4 h-4" /> Sécurité Admin</h3>
                    <div className="space-y-3">
                      <label className="text-xs font-bold">Code de création de compte</label>
                      <Input value={configForm.signupCode} onChange={(e) => setConfigForm({...configForm, signupCode: e.target.value})} className="font-mono" />
                    </div>
                  </div>
                </div>

                <div className="space-y-4 pt-4">
                   <h3 className="text-sm font-bold uppercase text-muted-foreground border-b pb-2">Notifications</h3>
                   <div className="space-y-2"><label className="text-xs font-bold">Email alertes admin</label><Input value={configForm.notificationEmail} onChange={(e) => setConfigForm({...configForm, notificationEmail: e.target.value})} /></div>
                </div>

                <Button onClick={() => setDocumentNonBlocking(doc(db, 'market_configurations', currentConfig!.id), { ...configForm }, { merge: true })} className="w-full h-12 text-lg font-bold">Sauvegarder Configuration</Button>
                
                <Separator />
                
                <div className="space-y-6">
                  <div className="flex justify-between items-center">
                    <h3 className="text-lg font-bold text-primary flex items-center gap-2"><Mail className="w-5 h-5" /> Templates d'Email</h3>
                    <Button onClick={() => { setEditingTemplateId(null); setTemplateForm({ name: '', subject: '', body: '' }); setIsTemplateFormVisible(true); }} size="sm" variant="outline"><Plus className="w-4 h-4 mr-2" /> Nouveau</Button>
                  </div>
                  <div className="grid gap-3">
                    {templates?.map(t => (
                      <div key={t.id} className="p-3 border rounded-lg flex justify-between items-center bg-white shadow-sm">
                        <div className="text-sm font-bold">{t.name}</div>
                        <div className="flex gap-2">
                          <Button size="sm" variant="ghost" onClick={() => { setEditingTemplateId(t.id); setTemplateForm({ name: t.name, subject: t.subject, body: t.body }); setIsTemplateFormVisible(true); }}><Settings className="w-4 h-4" /></Button>
                          <Button size="sm" variant="ghost" className="text-destructive" onClick={() => deleteDocumentNonBlocking(doc(db, 'email_templates', t.id))}><Trash2 className="w-4 h-4" /></Button>
                        </div>
                      </div>
                    ))}
                  </div>

                  {isTemplateFormVisible && (
                    <div className="p-6 border-2 border-primary/20 rounded-xl bg-primary/5 space-y-4 mt-6">
                      <Input placeholder="Nom du template" value={templateForm.name} onChange={e => setTemplateForm({...templateForm, name: e.target.value})} />
                      <Input placeholder="Sujet de l'email" value={templateForm.subject} onChange={e => setTemplateForm({...templateForm, subject: e.target.value})} />
                      <div className="space-y-2">
                        <EditorToolbar textareaRef={templateTextareaRef} setter={setTemplateForm} isPreview={isTemplatePreviewMode} onTogglePreview={() => setIsTemplatePreviewMode(!isTemplatePreviewMode)} />
                        {!isTemplatePreviewMode ? <Textarea ref={templateTextareaRef} value={templateForm.body} onChange={e => setTemplateForm({...templateForm, body: e.target.value})} rows={8} className="font-mono text-xs rounded-t-none" /> : <div className="p-4 bg-white border border-t-0 rounded-b-lg min-h-[150px] text-sm prose max-w-none" dangerouslySetInnerHTML={{ __html: templateForm.body }} />}
                      </div>
                      <div className="flex gap-2 pt-2"><Button onClick={handleSaveTemplate} className="flex-1">Sauvegarder</Button><Button variant="ghost" onClick={() => setIsTemplateFormVisible(false)}>Annuler</Button></div>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="admins" className="space-y-6">
            <div className="grid md:grid-cols-2 gap-8">
              <Card className="border-t-4 border-t-amber-500"><CardHeader><CardTitle className="text-lg">Demandes d'accès</CardTitle></CardHeader>
                <CardContent className="space-y-4">
                  {adminRequests?.filter(r => r.status === 'PENDING').map(r => (
                    <div key={r.id} className="p-4 border rounded-lg bg-amber-50/50 flex justify-between items-center">
                      <div className="font-bold text-sm">{r.email}</div>
                      <div className="flex gap-2">
                        <Button size="sm" className="bg-green-600" onClick={() => { setDocumentNonBlocking(doc(db, 'roles_admin', r.id), { email: r.email, addedAt: new Date().toISOString(), isSuperAdmin: false }, { merge: true }); updateDocumentNonBlocking(doc(db, 'admin_requests', r.id), { status: 'APPROVED' }); }}><CheckCircle className="w-4 h-4" /></Button>
                        <Button size="sm" variant="destructive" onClick={() => updateDocumentNonBlocking(doc(db, 'admin_requests', r.id), { status: 'REJECTED' })}><XCircle className="w-4 h-4" /></Button>
                      </div>
                    </div>
                  ))}
                  {(!adminRequests || adminRequests.filter(r => r.status === 'PENDING').length === 0) && <p className="text-center text-xs text-muted-foreground italic py-4">Aucune demande en attente</p>}
                </CardContent>
              </Card>
              <Card className="border-t-4 border-t-primary"><CardHeader><CardTitle className="text-lg">Équipe Admin</CardTitle></CardHeader>
                <CardContent className="space-y-3">
                  {adminRoles?.map(a => (
                    <div key={a.id} className="p-3 border rounded-lg flex justify-between items-center text-sm">
                      <div className="flex flex-col">
                        <div className="font-medium">{a.email}</div>
                        {a.isSuperAdmin && <div className="text-[10px] text-primary font-bold flex items-center gap-1"><ShieldCheck className="w-3 h-3" /> Super Admin</div>}
                      </div>
                      <div className="flex gap-2">
                        {isSuperAdmin && a.id !== user.uid && (
                          <Button 
                            size="sm" 
                            variant="ghost" 
                            title={a.isSuperAdmin ? "Retirer Super Admin" : "Promouvoir Super Admin"}
                            onClick={() => updateDocumentNonBlocking(doc(db, 'roles_admin', a.id), { isSuperAdmin: !a.isSuperAdmin })}
                            className={a.isSuperAdmin ? "text-primary" : "text-muted-foreground"}
                          >
                            <ShieldCheck className="w-4 h-4" />
                          </Button>
                        )}
                        {a.id !== user.uid && <Button size="sm" variant="ghost" className="text-destructive" title="Supprimer" onClick={() => { if(confirm("Supprimer cet accès ?")) deleteDocumentNonBlocking(doc(db, 'roles_admin', a.id)); }}><Trash2 className="w-4 h-4" /></Button>}
                      </div>
                    </div>
                  ))}
                </CardContent>
              </Card>
            </div>
          </TabsContent>
        </Tabs>
      </main>

      {/* Edit Exhibitor Dialog */}
      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader><DialogTitle className="flex items-center gap-2"><Pencil className="w-6 h-6" /> Modifier : {actingExhibitor?.companyName}</DialogTitle></DialogHeader>
          <div className="py-6 space-y-6">
            <div className="grid md:grid-cols-2 gap-4">
              <div className="space-y-2"><Label>Prénom</Label><Input value={editFormData.firstName} onChange={e => setEditFormData({...editFormData, firstName: e.target.value})} /></div>
              <div className="space-y-2"><Label>Nom</Label><Input value={editFormData.lastName} onChange={e => setEditFormData({...editFormData, lastName: e.target.value})} /></div>
              <div className="space-y-2 md:col-span-2"><Label>Enseigne</Label><Input value={editFormData.companyName} onChange={e => setEditFormData({...editFormData, companyName: e.target.value})} /></div>
              <div className="space-y-2"><Label>Email</Label><Input type="email" value={editFormData.email} onChange={e => setEditFormData({...editFormData, email: e.target.value})} /></div>
              <div className="space-y-2"><Label>Téléphone</Label><Input value={editFormData.phone} onChange={e => setEditFormData({...editFormData, phone: e.target.value})} /></div>
            </div>
            
            <Separator />
            
            <div className="space-y-4">
              <Label className="text-primary font-bold">Options Logistiques</Label>
              <div className="grid md:grid-cols-2 gap-6">
                <div className="space-y-3">
                  <Label>Taille Emplacement</Label>
                  <RadioGroup value={editFormData.requestedTables} onValueChange={(v: any) => setEditFormData({...editFormData, requestedTables: v})} className="flex flex-col gap-2">
                    <div className="flex items-center space-x-2"><RadioGroupItem value="1" id="e-table-1" /><Label htmlFor="e-table-1">1 Table (1m75)</Label></div>
                    <div className="flex items-center space-x-2"><RadioGroupItem value="2" id="e-table-2" /><Label htmlFor="e-table-2">2 Tables (3m50)</Label></div>
                  </RadioGroup>
                </div>
                <div className="space-y-3">
                  <Label>Repas Dimanche Midi</Label>
                  <Input type="number" value={editFormData.sundayLunchCount} onChange={e => setEditFormData({...editFormData, sundayLunchCount: parseInt(e.target.value) || 0})} className="w-24" />
                </div>
              </div>
              
              <div className="flex flex-wrap gap-4 pt-2">
                <div className="flex items-center space-x-2">
                  <Checkbox id="e-elec" checked={editFormData.needsElectricity} onCheckedChange={(v: any) => setEditFormData({...editFormData, needsElectricity: v})} />
                  <Label htmlFor="e-elec">Electricité</Label>
                </div>
                <div className="flex items-center space-x-2">
                  <Checkbox id="e-grid" checked={editFormData.needsGrid} onCheckedChange={(v: any) => setEditFormData({...editFormData, needsGrid: v})} />
                  <Label htmlFor="e-grid">Grille Expo</Label>
                </div>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setIsEditDialogOpen(false)}>Annuler</Button>
            <Button onClick={handleEditSave} className="gap-2"><CheckCircle className="w-4 h-4" /> Enregistrer les modifications</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Individual Email Dialog */}
      <Dialog open={isIndividualEmailDialogOpen} onOpenChange={setIsIndividualEmailDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader><DialogTitle className="flex items-center gap-2"><Mail className="w-6 h-6" /> Email à {actingExhibitor?.companyName}</DialogTitle></DialogHeader>
          <div className="py-6 space-y-6">
            <Tabs value={individualEmailMode} onValueChange={(v: any) => setIndividualEmailMode(v)}>
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="template">Modèle</TabsTrigger>
                <TabsTrigger value="free">Message libre</TabsTrigger>
              </TabsList>
              
              <TabsContent value="template" className="pt-4 space-y-4">
                <Select value={selectedTemplateId} onValueChange={setSelectedTemplateId}>
                  <SelectTrigger><SelectValue placeholder="Choisir un modèle..." /></SelectTrigger>
                  <SelectContent>{templates?.map(t => <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>)}</SelectContent>
                </Select>
                {selectedTemplateId && (
                  <div className="p-4 border rounded-xl bg-muted/20 max-h-60 overflow-y-auto">
                    <p className="text-sm font-bold mb-2">Sujet : {templates?.find(t => t.id === selectedTemplateId)?.subject}</p>
                    <div className="text-sm prose max-w-none" dangerouslySetInnerHTML={{ __html: templates?.find(t => t.id === selectedTemplateId)?.body || "" }} />
                  </div>
                )}
              </TabsContent>
              
              <TabsContent value="free" className="pt-4 space-y-4">
                <Input placeholder="Sujet..." value={individualEmail.subject} onChange={e => setIndividualEmail({...individualEmail, subject: e.target.value})} />
                <div className="space-y-2">
                  <EditorToolbar 
                    textareaRef={individualEmailRef} 
                    setter={setIndividualEmail} 
                    isPreview={isIndividualEmailPreview} 
                    onTogglePreview={() => setIsIndividualEmailPreview(!isIndividualEmailPreview)} 
                  />
                  {!isIndividualEmailPreview ? (
                    <Textarea 
                      ref={individualEmailRef} 
                      placeholder="Message..." 
                      value={individualEmail.body} 
                      onChange={e => setIndividualEmail({...individualEmail, body: e.target.value})} 
                      rows={6} 
                      className="font-mono text-xs rounded-t-none" 
                    />
                  ) : (
                    <div className="p-4 bg-white border border-t-0 rounded-b-lg min-h-[150px] text-sm prose max-w-none" dangerouslySetInnerHTML={{ __html: individualEmail.body }} />
                  )}
                </div>
              </TabsContent>
            </Tabs>

            <div className="flex items-center space-x-2 p-3 bg-primary/5 rounded-lg border border-primary/10">
              <Checkbox id="include-link" checked={includeDossierLink} onCheckedChange={(v: any) => setIncludeDossierLink(v)} />
              <Label htmlFor="include-link" className="text-sm font-bold cursor-pointer flex items-center gap-2">
                <Link2 className="w-4 h-4" /> Inclure un bouton vers le dossier technique
              </Label>
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setIsIndividualEmailDialogOpen(false)}>Annuler</Button>
            <Button onClick={handleIndividualEmailSend} disabled={isSending || (individualEmailMode === 'template' && !selectedTemplateId) || (individualEmailMode === 'free' && (!individualEmail.subject || !individualEmail.body))} className="gap-2">
              {isSending ? <Loader2 className="animate-spin" /> : "Envoyer"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={isBulkEmailDialogOpen} onOpenChange={setIsBulkEmailDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader><DialogTitle className="flex items-center gap-2"><Send className="w-6 h-6" /> Message groupé</DialogTitle></DialogHeader>
          <div className="py-6 space-y-6">
            <Badge variant="secondary" className="px-4 py-2">Destinataires : {filteredExhibitors.filter(e => e.status === 'validated' || e.status === 'submitted_form2').length} acceptés</Badge>
            
            <Tabs value={bulkEmailMode} onValueChange={(v: any) => setBulkEmailMode(v)}>
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="template">Utiliser un modèle</TabsTrigger>
                <TabsTrigger value="free">Message libre</TabsTrigger>
              </TabsList>
              
              <TabsContent value="template" className="pt-4 space-y-4">
                <Select value={selectedTemplateId} onValueChange={setSelectedTemplateId}>
                  <SelectTrigger><SelectValue placeholder="Choisir un modèle..." /></SelectTrigger>
                  <SelectContent>{templates?.map(t => <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>)}</SelectContent>
                </Select>
                {selectedTemplateId && (
                  <div className="p-4 border rounded-xl bg-muted/20 max-h-60 overflow-y-auto">
                    <p className="text-sm font-bold mb-2">Sujet : {templates?.find(t => t.id === selectedTemplateId)?.subject}</p>
                    <div className="text-sm prose max-w-none" dangerouslySetInnerHTML={{ __html: templates?.find(t => t.id === selectedTemplateId)?.body || "" }} />
                  </div>
                )}
              </TabsContent>
              
              <TabsContent value="free" className="pt-4 space-y-4">
                <Input placeholder="Sujet de l'email..." value={freeBulkEmail.subject} onChange={e => setFreeBulkEmail({...freeBulkEmail, subject: e.target.value})} />
                <div className="space-y-2">
                  <EditorToolbar 
                    textareaRef={freeBulkEmailRef} 
                    setter={setFreeBulkEmail} 
                    isPreview={isFreeEmailPreview} 
                    onTogglePreview={() => setIsFreeEmailPreview(!isFreeEmailPreview)} 
                  />
                  {!isFreeEmailPreview ? (
                    <Textarea 
                      ref={freeBulkEmailRef} 
                      placeholder="Rédigez votre message ici..." 
                      value={freeBulkEmail.body} 
                      onChange={e => setFreeBulkEmail({...freeBulkEmail, body: e.target.value})} 
                      rows={8} 
                      className="font-mono text-xs rounded-t-none" 
                    />
                  ) : (
                    <div className="p-4 bg-white border border-t-0 rounded-b-lg min-h-[150px] text-sm prose max-w-none" dangerouslySetInnerHTML={{ __html: freeBulkEmail.body }} />
                  )}
                </div>
              </TabsContent>
            </Tabs>
          </div>
          <DialogFooter><Button variant="ghost" onClick={() => setIsBulkEmailDialogOpen(false)}>Annuler</Button><Button onClick={handleBulkEmailSend} disabled={isSending || (bulkEmailMode === 'template' && !selectedTemplateId) || (bulkEmailMode === 'free' && (!freeBulkEmail.subject || !freeBulkEmail.body))} className="gap-2">{isSending ? <Loader2 className="animate-spin" /> : "Envoyer"}</Button></DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={isAcceptDialogOpen} onOpenChange={setIsAcceptDialogOpen}>
        <DialogContent><DialogHeader><DialogTitle>Accepter {actingExhibitor?.companyName}</DialogTitle></DialogHeader>
          <div className="space-y-4 pt-4"><p className="text-sm">Enverra un email avec le bouton vers le dossier technique.</p><Textarea placeholder="Mot optionnel..." value={acceptanceMessage} onChange={e => setAcceptanceMessage(e.target.value)} rows={4} /></div>
          <DialogFooter className="mt-6"><Button variant="ghost" onClick={() => setIsAcceptDialogOpen(false)}>Annuler</Button><Button onClick={async () => { if (!actingExhibitor) return; setIsSending(true); updateDocumentNonBlocking(doc(db, 'pre_registrations', actingExhibitor.id), { status: 'accepted_form1', acceptedAt: new Date().toISOString() }); await sendAcceptanceEmail(actingExhibitor, acceptanceMessage, configForm); setIsAcceptDialogOpen(false); setIsSending(false); setAcceptanceMessage(''); toast({ title: "Accepté" }); }} disabled={isSending}>Confirmer</Button></DialogFooter>
        </DialogContent>
      </Dialog>
      
      <Dialog open={isRejectDialogOpen} onOpenChange={setIsRejectDialogOpen}>
        <DialogContent><DialogHeader><DialogTitle>Refuser la candidature</DialogTitle></DialogHeader>
          <div className="space-y-4 pt-4"><Button variant="outline" size="sm" onClick={async () => { if (!actingExhibitor) return; setIsSending(true); const res = await generateRejectionJustification({ applicantName: `${actingExhibitor.firstName} ${actingExhibitor.lastName}`, applicationSummary: actingExhibitor.productDescription, rejectionReasons: ["Manque de place"] }); setJustification(res.justificationMessage); setIsSending(false); }} disabled={isSending} className="gap-2"><Sparkles className="w-4 h-4" /> Justification IA</Button><Textarea value={justification} onChange={e => setJustification(e.target.value)} placeholder="Motif du refus..." rows={6} /></div>
          <DialogFooter className="mt-6"><Button variant="ghost" onClick={() => setIsRejectDialogOpen(false)}>Annuler</Button><Button variant="destructive" onClick={async () => { if (!actingExhibitor) return; setIsSending(true); updateDocumentNonBlocking(doc(db, 'pre_registrations', actingExhibitor.id), { status: 'rejected', rejectionJustification: justification }); await sendRejectionEmail(actingExhibitor, justification, configForm); setIsRejectDialogOpen(false); setIsSending(false); setJustification(''); }} disabled={isSending || !justification}>Confirmer</Button></DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!viewingExhibitor} onOpenChange={o => !o && setViewingExhibitor(null)}>
        <DialogContent className="max-w-4xl max-h-[90vh]">
          <DialogHeader>
            <DialogTitle className="flex items-center justify-between">
              <span>Fiche : {viewingExhibitor?.companyName}</span>
              <Badge variant={viewingExhibitor ? getStatusVariant(viewingExhibitor.status) : "outline"}>
                {viewingExhibitor ? getStatusLabel(viewingExhibitor.status) : ""}
              </Badge>
            </DialogTitle>
          </DialogHeader>
          <ScrollArea className="h-[70vh] pr-4">
             {viewingExhibitor && (
               <div className="space-y-10 p-4">
                 <div className="space-y-6">
                   <h3 className="text-sm font-bold uppercase text-primary border-b pb-2 flex items-center gap-2">
                     <FileText className="w-4 h-4" /> 1. Candidature Initiale
                   </h3>
                   <div className="grid md:grid-cols-2 gap-8">
                     <div className="space-y-3">
                       <p className="text-xs font-bold uppercase text-muted-foreground">Coordonnées</p>
                       <p className="font-bold">{viewingExhibitor.firstName} {viewingExhibitor.lastName}</p>
                       <p className="text-sm flex items-center gap-2"><Mail className="w-3 h-3" /> {viewingExhibitor.email}</p>
                       <p className="text-sm flex items-center gap-2"><Clock className="w-3 h-3" /> {viewingExhibitor.phone}</p>
                       <p className="text-sm pt-2">{viewingExhibitor.address}<br/>{viewingExhibitor.postalCode} {viewingExhibitor.city}</p>
                     </div>
                     <div className="space-y-3">
                       <p className="text-xs font-bold uppercase text-muted-foreground">Profil Exposant</p>
                       <div className="flex flex-wrap gap-2">
                         <Badge variant="outline">{viewingExhibitor.isRegistered ? "Professionnel" : "Particulier"}</Badge>
                         <Badge variant="secondary">{viewingExhibitor.requestedTables} table(s)</Badge>
                       </div>
                       {viewingExhibitor.websiteUrl && (
                         <a href={viewingExhibitor.websiteUrl} target="_blank" className="text-sm text-primary flex items-center gap-1 hover:underline">
                           <ExternalLink className="w-3 h-3" /> Site / Réseaux
                         </a>
                       )}
                       <p className="text-xs text-muted-foreground mt-4 italic">Inscrit le {new Date(viewingExhibitor.createdAt).toLocaleDateString()}</p>
                     </div>
                   </div>
                   <div className="space-y-2">
                     <p className="text-xs font-bold uppercase text-muted-foreground">Description Stand & Produits</p>
                     <p className="text-sm bg-muted/30 p-4 rounded-lg border leading-relaxed">{viewingExhibitor.productDescription}</p>
                   </div>
                   {viewingExhibitor.productImages && (
                     <div className="space-y-2">
                       <p className="text-xs font-bold uppercase text-muted-foreground">Galerie Photos Produits</p>
                       <div className="grid grid-cols-3 gap-4">
                         {viewingExhibitor.productImages.map((img, i) => (
                           <a key={i} href={img} target="_blank" className="relative aspect-square block overflow-hidden rounded-lg border shadow-sm group">
                             <img src={img} className="w-full h-full object-cover transition-transform group-hover:scale-110" />
                             <div className="absolute inset-0 bg-black/20 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                               <ExternalLink className="text-white w-6 h-6" />
                             </div>
                           </a>
                         ))}
                       </div>
                     </div>
                   )}
                 </div>

                 {viewingExhibitor.detailedInfo ? (
                   <div className="space-y-6 pt-6 border-t">
                     <h3 className="text-sm font-bold uppercase text-primary border-b pb-2 flex items-center gap-2">
                       <Zap className="w-4 h-4" /> 2. Dossier Technique (Finalisation)
                     </h3>
                     <div className="grid md:grid-cols-2 gap-8">
                       <div className="space-y-4">
                         <div className="space-y-1">
                           <p className="text-xs font-bold uppercase text-muted-foreground flex items-center gap-1"><CreditCard className="w-3 h-3" /> Administratif</p>
                           {viewingExhibitor.detailedInfo.siret && <p className="text-sm">SIRET : <strong>{viewingExhibitor.detailedInfo.siret}</strong></p>}
                           <div className="mt-2">
                             <p className="text-[10px] mb-1">Pièce d'identité :</p>
                             <a href={viewingExhibitor.detailedInfo.idCardPhoto} target="_blank" className="block relative aspect-video w-full max-w-[250px] border rounded overflow-hidden">
                               <img src={viewingExhibitor.detailedInfo.idCardPhoto} className="w-full h-full object-cover" />
                             </a>
                           </div>
                         </div>
                         <div className="space-y-1">
                           <p className="text-xs font-bold uppercase text-muted-foreground flex items-center gap-1"><Shield className="w-3 h-3" /> Assurance & Accord</p>
                           <p className="text-sm">Cie : {viewingExhibitor.detailedInfo.insuranceCompany || "N/A"}</p>
                           <p className="text-sm">Police : {viewingExhibitor.detailedInfo.insurancePolicyNumber || "N/A"}</p>
                           <div className="flex gap-2 mt-1">
                             {viewingExhibitor.detailedInfo.agreedToImageRights && <Badge variant="outline" className="text-[10px]">Droit Image OK</Badge>}
                             {viewingExhibitor.detailedInfo.agreedToTerms && <Badge variant="outline" className="text-[10px]">Règlement OK</Badge>}
                           </div>
                         </div>
                       </div>
                       <div className="space-y-4">
                         <div className="space-y-1">
                           <p className="text-xs font-bold uppercase text-muted-foreground flex items-center gap-1"><Settings className="w-3 h-3" /> Logistique</p>
                           <div className="flex flex-col gap-2">
                             <div className="flex items-center justify-between text-sm bg-muted/20 p-2 rounded">
                               <span className="flex items-center gap-2"><Zap className="w-3 h-3 text-amber-500" /> Électricité</span>
                               <Badge variant={viewingExhibitor.detailedInfo.needsElectricity ? "default" : "secondary"}>{viewingExhibitor.detailedInfo.needsElectricity ? "OUI" : "NON"}</Badge>
                             </div>
                             <div className="flex items-center justify-between text-sm bg-muted/20 p-2 rounded">
                               <span className="flex items-center gap-2"><LayoutGrid className="w-3 h-3 text-blue-500" /> Grille Expo</span>
                               <Badge variant={viewingExhibitor.detailedInfo.needsGrid ? "default" : "secondary"}>{viewingExhibitor.detailedInfo.needsGrid ? "OUI" : "NON"}</Badge>
                             </div>
                             <div className="flex items-center justify-between text-sm bg-muted/20 p-2 rounded">
                               <span className="flex items-center gap-2"><Utensils className="w-3 h-3 text-green-500" /> Repas Dimanche</span>
                               <Badge>{viewingExhibitor.detailedInfo.sundayLunchCount || 0}</Badge>
                             </div>
                           </div>
                         </div>
                         <div className="space-y-1">
                           <p className="text-xs font-bold uppercase text-muted-foreground flex items-center gap-1"><Gift className="w-3 h-3" /> Tombola solidaire</p>
                           <p className="text-sm">{viewingExhibitor.detailedInfo.tombolaLot ? "✅ Offre un lot" : "❌ Pas de lot"}</p>
                           {viewingExhibitor.detailedInfo.tombolaLotDescription && (
                             <p className="text-xs italic bg-amber-50 p-2 rounded border border-amber-100 mt-1">
                               "{viewingExhibitor.detailedInfo.tombolaLotDescription}"
                             </p>
                           )}
                         </div>
                       </div>
                     </div>
                     {viewingExhibitor.detailedInfo.additionalComments && (
                       <div className="space-y-2">
                         <p className="text-xs font-bold uppercase text-muted-foreground flex items-center gap-1"><MessageSquare className="w-3 h-3" /> Commentaires supplémentaires</p>
                         <p className="text-sm bg-primary/5 p-4 rounded-lg border italic">"{viewingExhibitor.detailedInfo.additionalComments}"</p>
                       </div>
                     )}
                   </div>
                 ) : (
                   <div className="p-8 border-2 border-dashed rounded-xl text-center bg-muted/10">
                     <Clock className="w-8 h-8 mx-auto text-muted-foreground/50 mb-2" />
                     <p className="text-sm text-muted-foreground font-medium">Le dossier technique n'a pas encore été complété par l'artisan.</p>
                     <p className="text-[10px] text-muted-foreground">Une fois l'étape 1 validée, l'exposant reçoit un lien pour remplir ces informations.</p>
                   </div>
                 )}

                 {viewingExhibitor.status === 'rejected' && viewingExhibitor.rejectionJustification && (
                   <div className="space-y-2 pt-6 border-t">
                     <h3 className="text-sm font-bold uppercase text-destructive border-b pb-2 flex items-center gap-2">
                       <XCircle className="w-4 h-4" /> Motif du refus
                     </h3>
                     <p className="text-sm bg-destructive/5 p-4 rounded-lg border border-destructive/10 italic leading-relaxed">
                       {viewingExhibitor.rejectionJustification}
                     </p>
                   </div>
                 )}
               </div>
             )}
          </ScrollArea>
          <DialogFooter className="mt-4 flex sm:justify-between items-center gap-4">
             <div className="text-[10px] text-muted-foreground">ID : {viewingExhibitor?.id}</div>
             <Button variant="outline" onClick={() => setViewingExhibitor(null)}>Fermer</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
