
"use client"
import React, { useEffect, useState, useMemo, useRef } from 'react';
import { Exhibitor } from '@/lib/types';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ChristmasSnow } from '@/components/ChristmasSnow';
import { CheckCircle, XCircle, Search, Mail, Loader2, Trash2, Eye, ShieldCheck, Sparkles, Download, Settings, Clock, ArrowLeft, Key, UserPlus, EyeOff, Plus, Send, Type, WrapText, Bold, Italic, Underline, Link as LucideLink, Image as ImageIcon } from 'lucide-react';
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

export default function AdminDashboard() {
  const { toast } = useToast();
  const db = useFirestore();
  const auth = useAuth();
  const { user, isUserLoading } = useUser();
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  
  const [searchTerm, setSearchTerm] = useState('');
  const [isAuthLoading, setIsAuthLoading] = useState(false);
  const [isSigningUp, setIsSigningUp] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [isSendingTest, setIsSendingTest] = useState(false);
  const [justification, setJustification] = useState('');
  const [acceptanceMessage, setAcceptanceMessage] = useState('');
  const [selectedConfigId, setSelectedConfigId] = useState<string>('');
  const [viewingExhibitor, setViewingExhibitor] = useState<Exhibitor | null>(null);
  
  const [isAcceptDialogOpen, setIsAcceptDialogOpen] = useState(false);
  const [isRejectDialogOpen, setIsRejectDialogOpen] = useState(false);
  const [actingExhibitor, setActingExhibitor] = useState<Exhibitor | null>(null);
  
  const [isBulkEmailDialogOpen, setIsBulkEmailDialogOpen] = useState(false);
  const [selectedTemplateId, setSelectedTemplateId] = useState<string>('');
  const [isPreviewMode, setIsPreviewMode] = useState(false);
  const [isTemplateFormVisible, setIsTemplateFormVisible] = useState(false);
  
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [signupCodeInput, setSignupCodeInput] = useState('');
  const [inputActivationCode, setInputActivationCode] = useState('');
  const [authError, setAuthError] = useState('');
  const [testEmailAddress, setTestEmailAddress] = useState('');

  const logoUrl = "https://i.ibb.co/yncRPkvR/logo-ujpf.jpg";
  const isSuperAdmin = user?.email === "hugues.rabier@gmail.com";

  // Auth check
  const userRoleRef = useMemoFirebase(() => user ? doc(db, 'roles_admin', user.uid) : null, [db, user]);
  const { data: userRoleDoc, isLoading: isRoleLoading } = useDoc(userRoleRef);
  const isAuthorized = isSuperAdmin || !!userRoleDoc;

  // Personal Request Check
  const myRequestRef = useMemoFirebase(() => user ? doc(db, 'admin_requests', user.uid) : null, [db, user]);
  const { data: myRequest } = useDoc(myRequestRef);

  // Market Configs
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

  // Email Templates
  const templatesQuery = useMemoFirebase(() => {
    if (!isAuthorized) return null;
    return query(collection(db, 'email_templates'), orderBy('createdAt', 'desc'));
  }, [db, isAuthorized]);
  const { data: templates } = useCollection(templatesQuery);

  // Admin Requests (SuperAdmin Only)
  const adminRequestsQuery = useMemoFirebase(() => isSuperAdmin ? query(collection(db, 'admin_requests'), orderBy('requestedAt', 'desc')) : null, [db, isSuperAdmin]);
  const { data: adminRequests } = useCollection(adminRequestsQuery);

  // Current Admins (SuperAdmin Only)
  const adminRolesQuery = useMemoFirebase(() => isSuperAdmin ? collection(db, 'roles_admin') : null, [db, isSuperAdmin]);
  const { data: adminRoles } = useCollection(adminRolesQuery);

  // Exhibitors Data
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

  // Stats
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

  const handleSendTestEmail = async () => {
    if (!testEmailAddress || !templateForm.subject || !templateForm.body) {
      toast({ variant: "destructive", title: "Champs manquants", description: "Veuillez remplir le sujet et le corps du message." });
      return;
    }
    setIsSendingTest(true);
    const res = await sendTestEmailAction(testEmailAddress, templateForm.subject, templateForm.body);
    if (res.success) {
      toast({ title: "Email de test envoyé !" });
    } else {
      toast({ variant: "destructive", title: "Échec de l'envoi", description: res.error });
    }
    setIsSendingTest(false);
  };

  const insertTag = (tag: string, closeTag?: string) => {
    if (!textareaRef.current) return;
    const textarea = textareaRef.current;
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

    setTemplateForm(prev => ({ ...prev, body: newText }));
    setTimeout(() => {
      textarea.focus();
      textarea.setSelectionRange(start + tag.length + 2, start + tag.length + 2 + selected.length);
    }, 0);
  };

  const insertCustomSnippet = (snippet: string) => {
    if (!textareaRef.current) return;
    const textarea = textareaRef.current;
    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const text = textarea.value;
    const before = text.substring(0, start);
    const after = text.substring(end);

    const newText = `${before}${snippet}${after}`;
    setTemplateForm(prev => ({ ...prev, body: newText }));
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
    const res = await sendBulkEmailAction(emails, template.subject, template.body);
    if (res.success) {
      toast({ title: "Emails envoyés !", description: `${res.totalSent} emails envoyés avec succès.` });
    } else {
      toast({ variant: "destructive", title: "Erreur lors de l'envoi", description: `${res.totalSent} envoyés, ${res.totalFailed} échoués.` });
    }
    setIsBulkEmailDialogOpen(false);
    setIsSending(false);
  };

  const handleAuth = async (e: React.FormEvent, forceRequest: boolean = false) => {
    e.preventDefault();
    setAuthError('');
    setIsAuthLoading(true);

    try {
      if (isSigningUp) {
        const userCred = await initiateEmailSignUp(auth, email, password);
        const uid = userCred.user.uid;
        
        const masterCode = currentConfig?.signupCode || "FELIX2026";
        if (signupCodeInput === masterCode && !forceRequest) {
          setDocumentNonBlocking(doc(db, 'roles_admin', uid), { 
            addedAt: new Date().toISOString(),
            email: email 
          }, { merge: true });
          toast({ title: "Accès activé immédiatement !" });
        } else {
          // Génération automatique d'un code à 6 chiffres
          const autoGeneratedCode = Math.floor(100000 + Math.random() * 900000).toString();
          setDocumentNonBlocking(doc(db, 'admin_requests', uid), { 
            email: email, 
            requestedAt: new Date().toISOString(), 
            status: 'PENDING',
            invitationCode: autoGeneratedCode
          }, { merge: true });
          toast({ title: "Demande envoyée", description: "Votre compte a été créé. Un administrateur doit maintenant vous fournir votre code d'activation." });
        }
      } else {
        await initiateEmailSignIn(auth, email, password);
      }
    } catch (err: any) {
      setAuthError("Erreur d'authentification. Vérifiez vos identifiants.");
    } finally {
      setIsAuthLoading(false);
    }
  };

  const handleUnlockWithCode = () => {
    const masterCode = currentConfig?.signupCode || "FELIX2026";
    const personalCode = myRequest?.invitationCode;

    if (inputActivationCode === masterCode || (personalCode && inputActivationCode === personalCode)) {
      setDocumentNonBlocking(doc(db, 'roles_admin', user!.uid), { 
        addedAt: new Date().toISOString(),
        email: user!.email 
      }, { merge: true });
      updateDocumentNonBlocking(doc(db, 'admin_requests', user!.uid), { status: 'APPROVED' });
      toast({ title: "Accès activé !" });
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
                <Input 
                  type={showPassword ? "text" : "password"} 
                  placeholder="Mot de passe" 
                  value={password} 
                  onChange={(e) => setPassword(e.target.value)} 
                  required 
                  className="pr-10"
                />
                <button 
                  type="button" 
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-primary transition-colors"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>

              {isSigningUp && (
                <div className="space-y-2 animate-in fade-in slide-in-from-top-2 duration-300">
                  <Input 
                    placeholder="Code de création" 
                    value={signupCodeInput} 
                    onChange={(e) => setSignupCodeInput(e.target.value)}
                    className="bg-primary/5 border-primary/20 font-mono"
                  />
                  <p className="text-[10px] text-muted-foreground italic px-1">
                    Saisissez ici le code reçu pour activer votre compte immédiatement.
                  </p>
                </div>
              )}
              
              {authError && <p className="text-xs text-destructive text-center font-bold">{authError}</p>}
              
              <div className="space-y-3">
                <Button onClick={(e) => handleAuth(e)} disabled={isAuthLoading} className="w-full">
                  {isAuthLoading ? <Loader2 className="animate-spin" /> : (isSigningUp ? "S'inscrire" : "Connexion")}
                </Button>
                
                {isSigningUp && (
                  <Button type="button" variant="outline" onClick={(e) => handleAuth(e, true)} disabled={isAuthLoading} className="w-full text-xs h-10 border-amber-200 text-amber-700 hover:bg-amber-50">
                    Faire une demande de code de création
                  </Button>
                )}
              </div>
              
              {!isSigningUp ? (
                <Button type="button" variant="link" className="w-full text-xs text-muted-foreground" onClick={() => { setIsSigningUp(true); setAuthError(''); }}>
                  Pas de compte Admin. Solliciter un code
                </Button>
              ) : (
                <Button type="button" variant="ghost" className="w-full text-xs" onClick={() => { setIsSigningUp(false); setAuthError(''); }}>
                  Déjà un compte ? Connectez-vous
                </Button>
              )}
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
          <div className="relative mx-auto w-16 h-16 rounded-full bg-amber-100 flex items-center justify-center">
            <Clock className="w-8 h-8 text-amber-600 animate-pulse" />
          </div>
          <h2 className="text-xl font-bold">Accès en attente</h2>
          <p className="text-sm text-muted-foreground">Votre compte est créé. Saisissez le code d'activation fourni par l'administrateur.</p>
          
          <Tabs defaultValue="code" className="w-full">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="code">Saisir Code</TabsTrigger>
              <TabsTrigger value="request">Statut Demande</TabsTrigger>
            </TabsList>
            
            <TabsContent value="code" className="pt-4 space-y-4">
              <p className="text-xs font-bold uppercase text-muted-foreground">Entrez votre code d'activation</p>
              <div className="flex gap-2">
                <Input 
                  placeholder="Code à 6 chiffres" 
                  value={inputActivationCode} 
                  onChange={(e) => setInputActivationCode(e.target.value)} 
                />
                <Button onClick={handleUnlockWithCode}>Valider</Button>
              </div>
            </TabsContent>
            
            <TabsContent value="request" className="pt-4 space-y-4">
              {myRequest?.status === 'PENDING' ? (
                <div className="p-4 bg-amber-50 rounded-xl border border-amber-200">
                  <p className="text-sm text-amber-800 font-bold">Demande en cours</p>
                  <p className="text-xs text-amber-700 mt-1">L'administrateur a reçu votre demande. Une fois qu'il vous aura transmis votre code, saisissez-le dans l'onglet "Saisir Code".</p>
                </div>
              ) : (
                <Button onClick={handleManualRequest} className="w-full bg-amber-500 hover:bg-amber-600">
                  Envoyer une demande de code
                </Button>
              )}
            </TabsContent>
          </Tabs>

          <Button onClick={() => auth.signOut()} variant="ghost" className="w-full text-muted-foreground text-xs">Se déconnecter</Button>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <ChristmasSnow />
      <div className="bg-primary text-white py-4 shadow-lg sticky top-0 z-50">
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
              <TabsTrigger value="settings">Configuration</TabsTrigger>
              {isSuperAdmin && <TabsTrigger value="admins">Administrateurs</TabsTrigger>}
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
                <Button onClick={() => {
                  const exportData = filteredExhibitors.map(e => ({ "Enseigne": e.companyName, "Nom": e.lastName, "Prénom": e.firstName, "Email": e.email, "Statut": e.status }));
                  const ws = XLSX.utils.json_to_sheet(exportData);
                  const wb = XLSX.utils.book_new();
                  XLSX.utils.book_append_sheet(wb, ws, "Exposants");
                  XLSX.writeFile(wb, `Exposants_${currentConfig?.marketYear}.xlsx`);
                }} variant="outline" className="gap-2 text-primary font-bold bg-white"><Download className="w-4 h-4" /> Export Excel</Button>
              </div>
            </div>

            <Card className="overflow-hidden border-2 bg-white">
              <Table>
                <TableHeader className="bg-muted/30">
                  <TableRow><TableHead>Exposant</TableHead><TableHead>Tables</TableHead><TableHead>Statut</TableHead><TableHead className="text-right">Actions</TableHead></TableRow>
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
                          <Badge variant={
                            exhibitor.status === 'pending' ? 'secondary' : 
                            exhibitor.status === 'rejected' ? 'destructive' : 
                            exhibitor.status === 'validated' ? 'default' : 'secondary'
                          }>
                            {exhibitor.status === 'pending' ? 'À l\'étude' : exhibitor.status === 'validated' ? 'Confirmé' : exhibitor.status}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex justify-end gap-2">
                            <Button variant="outline" size="sm" onClick={() => setViewingExhibitor(exhibitor)}><Eye className="w-4 h-4" /></Button>
                            {exhibitor.status === 'pending' && (
                              <>
                                <Button size="sm" className="bg-green-600 hover:bg-green-700" onClick={() => { setActingExhibitor(exhibitor); setIsAcceptDialogOpen(true); }}><CheckCircle className="w-4 h-4" /></Button>
                                <Button size="sm" variant="destructive" onClick={() => { setActingExhibitor(exhibitor); setIsRejectDialogOpen(true); }}><XCircle className="w-4 h-4" /></Button>
                              </>
                            )}
                            {exhibitor.status === 'submitted_form2' && (
                              <Button size="sm" className="bg-blue-600" onClick={() => updateDocumentNonBlocking(doc(db, 'pre_registrations', exhibitor.id), { status: 'validated' })}>Valider</Button>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                </TableBody>
              </Table>
            </Card>
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
                  <div className="flex items-center gap-2 text-primary font-bold">
                    <Key className="w-5 h-5" /> Sécurité & Accès Admin
                  </div>
                  <div className="space-y-2">
                    <label className="text-xs font-bold uppercase text-muted-foreground">Code d'invitation secret (Global)</label>
                    <Input 
                      value={configForm.signupCode} 
                      onChange={(e) => setConfigForm({...configForm, signupCode: e.target.value})} 
                      placeholder="Ex: FELIX2026"
                      className="bg-white font-mono"
                    />
                    <p className="text-[10px] text-muted-foreground italic">Ce code global peut être fourni aux membres de confiance pour un accès immédiat.</p>
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-xs font-bold uppercase text-muted-foreground flex items-center gap-2"><ImageIcon className="w-3 h-3" /> URL de l'image de l'affiche</label>
                  <Input value={configForm.posterImageUrl} onChange={(e) => setConfigForm({...configForm, posterImageUrl: e.target.value})} placeholder="https://..." />
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-bold uppercase text-muted-foreground flex items-center gap-2"><Mail className="w-3 h-3" /> Email de notification</label>
                  <Input value={configForm.notificationEmail} onChange={(e) => setConfigForm({...configForm, notificationEmail: e.target.value})} placeholder="email@exemple.com" />
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
                <Button onClick={() => setDocumentNonBlocking(doc(db, 'market_configurations', currentConfig!.id), { ...configForm }, { merge: true })} className="w-full">Sauvegarder</Button>
                
                <Separator />
                
                <div className="space-y-4">
                  <div className="flex justify-between items-center">
                    <h3 className="text-lg font-bold text-primary flex items-center gap-2"><Mail className="w-5 h-5" /> Templates d'Email</h3>
                    <Button onClick={() => { setEditingTemplateId(null); setTemplateForm({ name: '', subject: '', body: '' }); setIsTemplateFormVisible(true); }} size="sm" variant="outline" className="gap-2"><Plus className="w-4 h-4" /> Nouveau</Button>
                  </div>
                  
                  <div className="grid gap-4">
                    {templates?.map(t => (
                      <div key={t.id} className="p-4 border rounded-xl bg-muted/20 flex justify-between items-start">
                        <div className="space-y-1">
                          <p className="font-bold">{t.name}</p>
                          <p className="text-xs text-muted-foreground">Sujet: {t.subject}</p>
                        </div>
                        <div className="flex gap-2">
                          <Button size="sm" variant="ghost" onClick={() => { 
                            setEditingTemplateId(t.id); 
                            setTemplateForm({ name: t.name, subject: t.subject, body: t.body }); 
                            setIsTemplateFormVisible(true); 
                          }}><Settings className="w-4 h-4" /></Button>
                          <Button size="sm" variant="ghost" className="text-destructive" onClick={() => deleteDocumentNonBlocking(doc(db, 'email_templates', t.id))}><Trash2 className="w-4 h-4" /></Button>
                        </div>
                      </div>
                    ))}
                  </div>

                  {isTemplateFormVisible && (
                    <div className="p-6 border-2 border-primary/20 rounded-2xl bg-primary/5 space-y-4">
                      <div className="flex justify-between items-center">
                        <h4 className="font-bold">{editingTemplateId ? "Modifier" : "Créer"} le template</h4>
                        <Button variant="ghost" size="sm" onClick={() => setIsPreviewMode(!isPreviewMode)} className="gap-2">
                          {isPreviewMode ? <><Type className="w-4 h-4" /> Édition</> : <><Eye className="w-4 h-4" /> Aperçu</>}
                        </Button>
                      </div>
                      
                      <div className="space-y-2"><label className="text-xs font-bold uppercase">Nom interne</label><Input value={templateForm.name} onChange={e => setTemplateForm({...templateForm, name: e.target.value})} /></div>
                      <div className="space-y-2"><label className="text-xs font-bold uppercase">Objet de l'email</label><Input value={templateForm.subject} onChange={e => setTemplateForm({...templateForm, subject: e.target.value})} /></div>
                      
                      <div className="space-y-2">
                        <label className="text-xs font-bold uppercase">Corps du message (HTML autorisé)</label>
                        {!isPreviewMode ? (
                          <>
                            <div className="flex flex-wrap gap-1 p-1 bg-muted rounded-md mb-1">
                              <Button variant="ghost" size="sm" onClick={() => insertTag('b', 'b')}><Bold className="w-4 h-4" /></Button>
                              <Button variant="ghost" size="sm" onClick={() => insertTag('i', 'i')}><Italic className="w-4 h-4" /></Button>
                              <Button variant="ghost" size="sm" onClick={() => insertTag('u', 'u')}><Underline className="w-4 h-4" /></Button>
                              <Separator orientation="vertical" className="h-8 mx-1" />
                              <Button variant="ghost" size="sm" onClick={() => insertTag('p', 'p')}><Type className="w-4 h-4" /></Button>
                              <Button variant="ghost" size="sm" onClick={() => insertTag('br')}><WrapText className="w-4 h-4" /></Button>
                              <Separator orientation="vertical" className="h-8 mx-1" />
                              <Button 
                                variant="ghost" 
                                size="sm" 
                                onClick={() => insertCustomSnippet(`<a href="${currentConfig?.posterImageUrl || ''}" target="_blank" style="color: #2E3192; font-weight: bold; text-decoration: underline;">Voir l'affiche du Marché</a>`)} 
                                className="text-primary hover:text-primary font-bold"
                              >
                                <LucideLink className="w-4 h-4 mr-1" /> Lien Affiche
                              </Button>
                            </div>
                            <Textarea 
                              ref={textareaRef}
                              rows={10} 
                              value={templateForm.body} 
                              onChange={e => setTemplateForm({...templateForm, body: e.target.value})} 
                              className="font-mono text-sm"
                            />
                          </>
                        ) : (
                          <div className="min-h-[200px] p-4 bg-white border rounded-md prose prose-sm max-w-none" dangerouslySetInnerHTML={{ __html: templateForm.body }} />
                        )}
                      </div>

                      <div className="flex gap-2 items-end border-t pt-4 mt-4 bg-white/50 p-3 rounded-lg border border-primary/10">
                        <div className="flex-1 space-y-1">
                          <label className="text-[10px] font-bold uppercase text-muted-foreground">Envoyer un test à :</label>
                          <Input 
                            placeholder="votre@email.com" 
                            value={testEmailAddress} 
                            onChange={e => setTestEmailAddress(e.target.value)}
                            className="h-8 text-xs bg-white"
                          />
                        </div>
                        <Button 
                          variant="outline" 
                          size="sm" 
                          onClick={handleSendTestEmail}
                          disabled={isSendingTest || !testEmailAddress || !templateForm.subject}
                          className="h-8 gap-2"
                        >
                          {isSendingTest ? <Loader2 className="w-3 h-3 animate-spin" /> : <Send className="w-3 h-3" />}
                          Tester
                        </Button>
                      </div>
                      
                      <div className="flex gap-2">
                        <Button onClick={handleSaveTemplate} className="flex-1">Sauvegarder</Button>
                        <Button variant="ghost" onClick={() => { setIsTemplateFormVisible(false); setEditingTemplateId(null); }}>Annuler</Button>
                      </div>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {isSuperAdmin && (
            <TabsContent value="admins" className="space-y-6">
              <div className="grid md:grid-cols-2 gap-8">
                <Card className="border-t-4 border-t-amber-500 shadow-md">
                  <CardHeader><CardTitle className="text-lg flex items-center gap-2 text-amber-600"><Clock className="w-5 h-5" /> Demandes de codes</CardTitle></CardHeader>
                  <CardContent>
                    <div className="space-y-4">
                      {adminRequests?.filter(r => r.status === 'PENDING').map(request => (
                        <div key={request.id} className="p-4 border rounded-xl flex flex-col gap-3 bg-amber-50/30">
                          <div className="flex justify-between items-start">
                            <div><p className="font-bold">{request.email}</p><p className="text-[10px] text-muted-foreground">Demandé le {new Date(request.requestedAt).toLocaleDateString()}</p></div>
                            <div className="flex gap-2">
                              <Button size="sm" className="bg-green-600" onClick={() => {
                                setDocumentNonBlocking(doc(db, 'roles_admin', request.id), { addedAt: new Date().toISOString(), email: request.email }, { merge: true });
                                updateDocumentNonBlocking(doc(db, 'admin_requests', request.id), { status: 'APPROVED' });
                                toast({ title: "Accès approuvé" });
                              }}><CheckCircle className="w-4 h-4" /></Button>
                              <Button size="sm" variant="destructive" onClick={() => updateDocumentNonBlocking(doc(db, 'admin_requests', request.id), { status: 'REJECTED' })}><XCircle className="w-4 h-4" /></Button>
                            </div>
                          </div>
                          <div className="p-2 bg-white rounded border border-amber-200 flex justify-between items-center">
                            <span className="text-xs font-bold text-muted-foreground">Code à lui transmettre :</span>
                            <span className="text-lg font-mono font-bold text-amber-600 tracking-wider">{request.invitationCode || '---'}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>

                <Card className="border-t-4 border-t-primary shadow-md">
                  <CardHeader><CardTitle className="text-lg flex items-center gap-2 text-primary"><ShieldCheck className="w-5 h-5" /> Administrateurs Actuels</CardTitle></CardHeader>
                  <CardContent>
                    <div className="space-y-4">
                      {adminRoles?.map(admin => (
                        <div key={admin.id} className="p-4 border rounded-xl flex justify-between items-center">
                          <div className="flex items-center gap-3">
                            <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold">{(admin.email || 'A').charAt(0).toUpperCase()}</div>
                            <div><p className="font-bold text-sm">{admin.email}</p><p className="text-[10px] text-muted-foreground">Depuis {new Date(admin.addedAt).toLocaleDateString()}</p></div>
                          </div>
                          {admin.id !== user.uid && <Button size="sm" variant="ghost" className="text-destructive" onClick={() => deleteDocumentNonBlocking(doc(db, 'roles_admin', admin.id))}><Trash2 className="w-4 h-4" /></Button>}
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              </div>
            </TabsContent>
          )}
        </Tabs>
      </main>

      {/* Les Dialogs existants restent inchangés... */}
      <Dialog open={isBulkEmailDialogOpen} onOpenChange={setIsBulkEmailDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader><DialogTitle className="flex items-center gap-2"><Send className="w-6 h-6" /> Message groupé</DialogTitle></DialogHeader>
          <div className="py-6 space-y-6">
            <div className="p-4 bg-amber-50 border border-amber-200 rounded-xl text-sm">
              <p className="font-bold text-amber-800">Destinataires : {confirmedExhibitors.length} exposants</p>
            </div>
            <Select value={selectedTemplateId} onValueChange={setSelectedTemplateId}>
              <SelectTrigger className="w-full"><SelectValue placeholder="Sélectionner un modèle..." /></SelectTrigger>
              <SelectContent>{templates?.map(t => <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>)}</SelectContent>
            </Select>
            {selectedTemplateId && (
              <div className="p-4 border rounded-xl bg-muted/20 max-h-60 overflow-y-auto">
                <p className="text-sm font-bold mb-2">Objet : {templates?.find(t => t.id === selectedTemplateId)?.subject}</p>
                <div className="text-sm prose prose-sm max-w-none" dangerouslySetInnerHTML={{ __html: templates?.find(t => t.id === selectedTemplateId)?.body || "" }} />
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setIsBulkEmailDialogOpen(false)}>Annuler</Button>
            <Button onClick={handleBulkEmailSend} disabled={isSending || !selectedTemplateId} className="gap-2">
              {isSending ? <Loader2 className="animate-spin" /> : <><Send className="w-4 h-4" /> Envoyer</>}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!viewingExhibitor} onOpenChange={o => !o && setViewingExhibitor(null)}>
        <DialogContent className="max-w-4xl max-h-[90vh]">
          <DialogHeader><DialogTitle>Dossier de {viewingExhibitor?.companyName}</DialogTitle></DialogHeader>
          <ScrollArea className="h-[70vh] p-4">
             {viewingExhibitor && (
               <div className="space-y-6">
                 <div className="grid grid-cols-2 gap-4">
                   <div><p className="text-xs font-bold uppercase text-muted-foreground">Contact</p><p>{viewingExhibitor.firstName} {viewingExhibitor.lastName}</p><p>{viewingExhibitor.email}</p><p>{viewingExhibitor.phone}</p></div>
                   <div><p className="text-xs font-bold uppercase text-muted-foreground">Adresse</p><p>{viewingExhibitor.address}</p><p>{viewingExhibitor.postalCode} {viewingExhibitor.city}</p></div>
                 </div>
                 <div><p className="text-xs font-bold uppercase text-muted-foreground">Description Stand</p><p className="whitespace-pre-wrap">{viewingExhibitor.productDescription}</p></div>
                 {viewingExhibitor.productImages && (
                   <div className="grid grid-cols-3 gap-4">
                     {viewingExhibitor.productImages.map((img, i) => <img key={i} src={img} className="rounded-lg border aspect-square object-cover" alt="Produit" />)}
                   </div>
                 )}
               </div>
             )}
          </ScrollArea>
        </DialogContent>
      </Dialog>
      
      <Dialog open={isAcceptDialogOpen} onOpenChange={setIsAcceptDialogOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Accepter {actingExhibitor?.companyName}</DialogTitle></DialogHeader>
          <div className="space-y-4 mt-4">
            <p className="text-sm text-muted-foreground">L'acceptation enverra automatiquement un e-mail avec un lien vers le dossier technique.</p>
            <Textarea placeholder="Mot personnel optionnel..." value={acceptanceMessage} onChange={e => setAcceptanceMessage(e.target.value)} rows={4} />
          </div>
          <DialogFooter className="mt-6">
            <Button variant="ghost" onClick={() => setIsAcceptDialogOpen(false)}>Annuler</Button>
            <Button onClick={async () => {
              if (!actingExhibitor) return;
              setIsSending(true);
              updateDocumentNonBlocking(doc(db, 'pre_registrations', actingExhibitor.id), { status: 'accepted_form1' });
              await sendAcceptanceEmail(actingExhibitor, acceptanceMessage, currentConfig);
              setIsAcceptDialogOpen(false); setIsSending(false); setAcceptanceMessage('');
              toast({ title: "Candidature acceptée et email envoyé" });
            }} disabled={isSending}>{isSending ? <Loader2 className="animate-spin" /> : "Confirmer l'acceptation"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={isRejectDialogOpen} onOpenChange={setIsRejectDialogOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Refuser la candidature</DialogTitle></DialogHeader>
          <div className="space-y-4 mt-4">
            <Button variant="outline" size="sm" onClick={async () => {
              if (!actingExhibitor) return;
              setIsSending(true);
              const res = await generateRejectionJustification({
                applicantName: `${actingExhibitor.firstName} ${actingExhibitor.lastName}`,
                applicationSummary: actingExhibitor.productDescription,
                rejectionReasons: ["Manque de place", "Catégorie déjà saturée"]
              });
              setJustification(res.justificationMessage);
              setIsSending(false);
            }} disabled={isSending} className="gap-2"><Sparkles className="w-4 h-4" /> Générer avec l'IA</Button>
            <Textarea value={justification} onChange={e => setJustification(e.target.value)} placeholder="Motif du refus..." rows={6} />
          </div>
          <DialogFooter className="mt-6">
            <Button variant="ghost" onClick={() => setIsRejectDialogOpen(false)}>Annuler</Button>
            <Button variant="destructive" onClick={async () => {
              if (!actingExhibitor) return;
              setIsSending(true);
              updateDocumentNonBlocking(doc(db, 'pre_registrations', actingExhibitor.id), { status: 'rejected', rejectionJustification: justification });
              await sendRejectionEmail(actingExhibitor, justification, currentConfig);
              setIsRejectDialogOpen(false); setIsSending(false); setJustification('');
              toast({ title: "Candidature refusée" });
            }} disabled={isSending || !justification}>Confirmer le refus</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
