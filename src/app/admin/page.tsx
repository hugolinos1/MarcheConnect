
"use client"
import React, { useEffect, useState } from 'react';
import { Exhibitor } from '@/lib/types';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { ChristmasSnow } from '@/components/ChristmasSnow';
import { CheckCircle, XCircle, FileText, Search, Mail, Loader2, Trash2, Eye, ShieldCheck, Sparkles, Download, Settings, UserPlus, Users, AlertTriangle, ExternalLink, UserCheck, Clock, ArrowLeft, Phone, MapPin, Globe } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { generateRejectionJustification } from '@/ai/flows/generate-rejection-justification';
import { Textarea } from '@/components/ui/textarea';
import Link from 'next/link';
import { sendAcceptanceEmail, sendRejectionEmail, testSmtpGmail } from '@/app/actions/email-actions';
import { useToast } from '@/hooks/use-toast';
import { useFirestore, useMemoFirebase, useCollection, useUser, useAuth, useDoc } from '@/firebase';
import { collection, doc, query, orderBy, where, deleteDoc } from 'firebase/firestore';
import { updateDocumentNonBlocking, setDocumentNonBlocking, deleteDocumentNonBlocking } from '@/firebase/non-blocking-updates';
import { initiateEmailSignIn, initiateEmailSignUp } from '@/firebase/non-blocking-login';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Separator } from '@/components/ui/separator';
import * as XLSX from 'xlsx';

export default function AdminDashboard() {
  const { toast } = useToast();
  const db = useFirestore();
  const auth = useAuth();
  const { user, isUserLoading } = useUser();
  
  const [searchTerm, setSearchTerm] = useState('');
  const [isAuthLoading, setIsAuthLoading] = useState(false);
  const [isSigningUp, setIsSigningUp] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [justification, setJustification] = useState('');
  const [acceptanceMessage, setAcceptanceMessage] = useState('');
  const [selectedConfigId, setSelectedConfigId] = useState<string>('');
  const [viewingExhibitor, setViewingExhibitor] = useState<Exhibitor | null>(null);
  
  const [isAcceptDialogOpen, setIsAcceptDialogOpen] = useState(false);
  const [isRejectDialogOpen, setIsRejectDialogOpen] = useState(false);
  const [actingExhibitor, setActingExhibitor] = useState<Exhibitor | null>(null);
  
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [authError, setAuthError] = useState('');

  // Admin management state
  const [newAdminUid, setNewAdminUid] = useState('');
  const [isAdminAdding, setIsAdminAdding] = useState(false);
  const [isRequestingAccess, setIsRequestingAccess] = useState(false);

  const logoUrl = "https://i.ibb.co/yncRPkvR/logo-ujpf.jpg";

  const userRoleRef = useMemoFirebase(() => {
    if (!user || !user.uid) return null;
    return doc(db, 'roles_admin', user.uid);
  }, [db, user]);
  const { data: userRoleDoc, isLoading: isRoleLoading } = useDoc(userRoleRef);

  const userRequestRef = useMemoFirebase(() => {
    if (!user || !user.uid) return null;
    return doc(db, 'admin_requests', user.uid);
  }, [db, user]);
  const { data: pendingRequest } = useDoc(userRequestRef);

  const isSuperAdmin = user?.email === "hugues.rabier@gmail.com";
  const isAuthorized = isSuperAdmin || !!userRoleDoc;

  const marketConfigsQuery = useMemoFirebase(() => query(collection(db, 'market_configurations'), orderBy('marketYear', 'desc')), [db]);
  const { data: configs } = useCollection(marketConfigsQuery);
  
  const currentConfig = configs?.find(c => c.id === selectedConfigId) || configs?.find(c => c.currentMarket) || configs?.[0];

  useEffect(() => {
    if (currentConfig && !selectedConfigId) {
      setSelectedConfigId(currentConfig.id);
    }
  }, [currentConfig, selectedConfigId]);

  const exhibitorsQuery = useMemoFirebase(() => {
    if (!isAuthorized || !selectedConfigId) return null;
    return query(
      collection(db, 'pre_registrations'), 
      where('marketConfigurationId', '==', selectedConfigId)
    );
  }, [db, isAuthorized, selectedConfigId]);
  
  const { data: exhibitorsData, isLoading: isExhibitorsLoading } = useCollection<Exhibitor>(exhibitorsQuery);

  // Admin list query
  const adminsQuery = useMemoFirebase(() => isSuperAdmin ? collection(db, 'roles_admin') : null, [db, isSuperAdmin]);
  const { data: adminsList, isLoading: isAdminsLoading } = useCollection(adminsQuery);

  // Admin requests query
  const adminRequestsQuery = useMemoFirebase(() => isSuperAdmin ? collection(db, 'admin_requests') : null, [db, isSuperAdmin]);
  const { data: adminRequestsList } = useCollection(adminRequestsQuery);

  const [configForm, setConfigForm] = useState({
    marketYear: 2026,
    editionNumber: "6ème",
    posterImageUrl: "https://i.ibb.co/3y3KRNW4/Affiche-March.jpg",
    notificationEmail: "lemarchedefelix2020@gmail.com",
    priceTable1: 40,
    priceTable2: 60,
    priceMeal: 8,
    priceElectricity: 1
  });

  useEffect(() => {
    if (currentConfig) {
      setConfigForm({
        marketYear: currentConfig.marketYear,
        editionNumber: currentConfig.editionNumber,
        posterImageUrl: currentConfig.posterImageUrl,
        notificationEmail: currentConfig.notificationEmail || "lemarchedefelix2020@gmail.com",
        priceTable1: currentConfig.priceTable1 ?? 40,
        priceTable2: currentConfig.priceTable2 ?? 60,
        priceMeal: currentConfig.priceMeal ?? 8,
        priceElectricity: currentConfig.priceElectricity ?? 1
      });
    }
  }, [currentConfig]);

  const handleAuth = (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError('');
    setIsAuthLoading(true);
    
    const authPromise = isSigningUp 
      ? initiateEmailSignUp(auth, email, password)
      : initiateEmailSignIn(auth, email, password);

    authPromise
      .catch((err: any) => {
        if (err.code === 'auth/email-already-in-use') setAuthError("Cet email est déjà utilisé.");
        else if (err.code === 'auth/weak-password') setAuthError("Le mot de passe est trop court.");
        else if (err.code === 'auth/invalid-credential') setAuthError("Identifiants incorrects.");
        else setAuthError("Erreur d'authentification.");
      })
      .finally(() => setIsAuthLoading(false));
  };

  const handleRequestAccess = () => {
    if (!user) return;
    setIsRequestingAccess(true);
    setDocumentNonBlocking(doc(db, 'admin_requests', user.uid), {
      email: user.email,
      requestedAt: new Date().toISOString(),
      status: 'PENDING'
    }, { merge: true });
    toast({ title: "Demande envoyée", description: "L'administrateur principal va examiner votre demande." });
    setIsRequestingAccess(false);
  };

  const handleApproveRequest = (requestId: string, requestEmail: string) => {
    setDocumentNonBlocking(doc(db, 'roles_admin', requestId), {
      addedAt: new Date().toISOString(),
      email: requestEmail
    }, { merge: true });
    deleteDocumentNonBlocking(doc(db, 'admin_requests', requestId));
    toast({ title: "Demande approuvée", description: `Accès accordé à ${requestEmail}` });
  };

  const handleSaveConfig = () => {
    const configId = selectedConfigId || `config-${configForm.marketYear}`;
    setDocumentNonBlocking(doc(db, 'market_configurations', configId), { ...configForm, id: configId, currentMarket: true }, { merge: true });
    toast({ title: "Paramètres enregistrés" });
  };

  const handleAddAdmin = () => {
    if (!newAdminUid.trim()) return;
    setIsAdminAdding(true);
    setDocumentNonBlocking(doc(db, 'roles_admin', newAdminUid.trim()), { addedAt: new Date().toISOString() }, { merge: true });
    setNewAdminUid('');
    setIsAdminAdding(false);
    toast({ title: "Accès administrateur ajouté" });
  };

  const handleAcceptAndSend = async () => {
    if (!actingExhibitor) return;
    
    const targetExhibitor = actingExhibitor;
    setIsAcceptDialogOpen(false);
    setIsSending(true);
    
    updateDocumentNonBlocking(doc(db, 'pre_registrations', targetExhibitor.id), { status: 'accepted_form1' });

    try {
      const result = await sendAcceptanceEmail(targetExhibitor, acceptanceMessage, currentConfig);
      
      if (result.success) {
        toast({ title: "Candidature acceptée", description: "L'e-mail Gmail a été envoyé." });
      } else {
        toast({ 
          variant: "destructive", 
          title: "Dossier validé, Email en échec", 
          description: `Erreur : ${result.error}` 
        });
      }
    } catch (err: any) {
      toast({ variant: "destructive", title: "Erreur technique e-mail" });
    } finally {
      setIsSending(false);
      setActingExhibitor(null);
      setAcceptanceMessage('');
    }
  };

  const handleConfirmReject = async () => {
    if (!actingExhibitor) return;
    const targetExhibitor = actingExhibitor;
    setIsRejectDialogOpen(false);
    setIsSending(true);
    
    updateDocumentNonBlocking(doc(db, 'pre_registrations', targetExhibitor.id), { 
      status: 'rejected', 
      rejectionJustification: justification 
    });

    try {
      const result = await sendRejectionEmail(targetExhibitor, justification, currentConfig);
      if (result.success) {
        toast({ title: "Candidature refusée", description: "L'e-mail a été envoyé." });
      } else {
        toast({ variant: "destructive", title: "Email non envoyé", description: "Refus enregistré mais échec SMTP Gmail." });
      }
    } catch (err) {
      toast({ variant: "destructive", title: "Erreur technique" });
    } finally {
      setIsSending(false);
      setActingExhibitor(null);
      setJustification('');
    }
  };

  const handleTestSmtp = async () => {
    toast({ title: "Test SMTP Gmail en cours..." });
    const res = await testSmtpGmail();
    if (res.success) {
      toast({ title: "Test SMTP Réussi", description: "L'e-mail Gmail a bien été envoyé." });
    } else {
      toast({ variant: "destructive", title: "Test SMTP Échoué", description: res.error });
    }
  };

  const handleGenerateRejectIA = async (reasons: string[]) => {
    if (!actingExhibitor) return;
    setIsGenerating(true);
    try {
      const result = await generateRejectionJustification({
        applicantName: `${actingExhibitor.firstName} ${actingExhibitor.lastName}`,
        applicationSummary: actingExhibitor.productDescription,
        rejectionReasons: reasons,
      });
      setJustification(result.justificationMessage);
    } catch (err) {
      toast({ title: "Erreur IA", variant: "destructive" });
    } finally {
      setIsGenerating(false);
    }
  };

  const handleExportExcel = () => {
    if (!exhibitorsData) return;
    const exportData = filteredExhibitors.map(e => ({
      "Enseigne": e.companyName,
      "Nom": e.lastName,
      "Prénom": e.firstName,
      "Email": e.email,
      "Ville": e.city,
      "Tables": e.requestedTables,
      "Statut": e.status,
      "Repas": e.detailedInfo?.sundayLunchCount || 0,
      "Electricité": e.detailedInfo?.needsElectricity ? "Oui" : "Non"
    }));
    const worksheet = XLSX.utils.json_to_sheet(exportData);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Exposants");
    XLSX.writeFile(workbook, `Exposants_${currentConfig?.marketYear}.xlsx`);
  };

  const filteredExhibitors = (exhibitorsData || []).filter(e => 
    e.companyName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    `${e.firstName} ${e.lastName}`.toLowerCase().includes(searchTerm.toLowerCase())
  );

  if (isUserLoading || isRoleLoading) return <div className="min-h-screen flex items-center justify-center"><Loader2 className="animate-spin" /></div>;

  if (!user) {
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center p-4">
        <Card className="max-w-md w-full border-t-4 border-t-primary shadow-xl mb-4">
          <CardHeader className="text-center">
            <div className="mx-auto w-12 h-12 bg-primary/10 rounded-full flex items-center justify-center mb-4">
               <ShieldCheck className="w-6 h-6 text-primary" />
            </div>
            <CardTitle className="text-primary">{isSigningUp ? "Créer un compte" : "Administration"}</CardTitle>
            <CardDescription>Accédez à l'espace de gestion du marché</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleAuth} className="space-y-4">
              <Input type="email" placeholder="Email" value={email} onChange={(e) => setEmail(e.target.value)} required />
              <Input type="password" placeholder="Mot de passe" value={password} onChange={(e) => setPassword(e.target.value)} required />
              {authError && <p className="text-xs text-destructive text-center font-bold">{authError}</p>}
              <Button type="submit" disabled={isAuthLoading} className="w-full">
                {isAuthLoading ? <Loader2 className="animate-spin" /> : (isSigningUp ? "S'inscrire" : "Connexion")}
              </Button>
              <Button 
                type="button" 
                variant="ghost" 
                className="w-full text-xs" 
                onClick={() => setIsSigningUp(!isSigningUp)}
              >
                {isSigningUp ? "Déjà un compte ? Connectez-vous" : "Pas encore de compte ? Inscrivez-vous"}
              </Button>
            </form>
          </CardContent>
        </Card>
        <Button asChild variant="ghost" className="text-muted-foreground gap-2">
          <Link href="/"><ArrowLeft className="w-4 h-4" /> Retour à l'accueil</Link>
        </Button>
      </div>
    );
  }

  if (!isAuthorized) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <Card className="max-w-md w-full border-t-4 border-t-amber-500 shadow-xl">
          <CardHeader className="text-center">
            <div className="mx-auto w-16 h-16 bg-amber-100 rounded-full flex items-center justify-center mb-4">
               <Clock className="w-8 h-8 text-amber-600 animate-pulse" />
            </div>
            <CardTitle className="text-amber-600">Accès restreint</CardTitle>
            <CardDescription>Votre compte ({user.email}) n'est pas encore autorisé à accéder à l'administration.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {pendingRequest ? (
              <Alert className="bg-amber-50 border-amber-200">
                <Clock className="h-4 w-4" />
                <AlertTitle>Demande en cours</AlertTitle>
                <AlertDescription>
                  Votre demande d'accès a été envoyée le {new Date(pendingRequest.requestedAt).toLocaleDateString()}. L'administrateur principal doit la valider.
                </AlertDescription>
              </Alert>
            ) : (
              <div className="space-y-4">
                <p className="text-sm text-center text-muted-foreground">
                  Souhaitez-vous demander un accès administrateur à Hugues Rabier ?
                </p>
                <Button onClick={handleRequestAccess} disabled={isRequestingAccess} className="w-full bg-primary gap-2">
                  {isRequestingAccess ? <Loader2 className="animate-spin w-4 h-4" /> : <UserPlus className="w-4 h-4" />}
                  Demander l'accès
                </Button>
              </div>
            )}
            <div className="pt-4 border-t text-center">
              <p className="text-[10px] text-muted-foreground uppercase font-bold mb-2">Vos identifiants techniques</p>
              <code className="text-[10px] bg-muted p-2 rounded block break-all font-mono">UID: {user.uid}</code>
            </div>
            <div className="flex flex-col gap-2">
              <Button onClick={() => auth.signOut()} variant="outline" className="w-full">Se déconnecter</Button>
              <Button asChild variant="ghost" className="w-full">
                <Link href="/">Retour à l'accueil</Link>
              </Button>
            </div>
          </CardContent>
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
            <h1 className="text-lg font-bold">Le Marché de Félix : Admin</h1>
          </div>
          <div className="flex gap-2">
            <Button asChild variant="secondary" size="sm" className="font-bold"><Link href="/">Site Public</Link></Button>
            <Button onClick={() => auth.signOut()} variant="ghost" size="sm" className="text-white border border-white/50">Déconnexion</Button>
          </div>
        </div>
      </div>

      <main className="container mx-auto px-4 py-8 space-y-8">
        <Tabs defaultValue="exhibitors">
          <TabsList className="mb-6">
            <TabsTrigger value="exhibitors">Candidatures</TabsTrigger>
            <TabsTrigger value="settings">Configuration</TabsTrigger>
            {isSuperAdmin && <TabsTrigger value="admins">Administrateurs</TabsTrigger>}
          </TabsList>

          <TabsContent value="exhibitors" className="space-y-6">
            <div className="flex flex-col md:flex-row gap-4 items-center">
              <div className="relative flex-1 w-full"><Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" /><Input placeholder="Rechercher..." className="pl-10" value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} /></div>
              <Button onClick={handleExportExcel} variant="outline" className="gap-2 text-primary font-bold"><Download className="w-4 h-4" /> Exporter Excel</Button>
            </div>

            <Card className="overflow-hidden border-2">
              <Table>
                <TableHeader className="bg-muted/30">
                  <TableRow><TableHead>Enseigne</TableHead><TableHead>Tables</TableHead><TableHead>Statut</TableHead><TableHead className="text-right">Actions</TableHead></TableRow>
                </TableHeader>
                <TableBody>
                  {isExhibitorsLoading ? <TableRow><TableCell colSpan={4} className="text-center py-8"><Loader2 className="animate-spin mx-auto" /></TableCell></TableRow> :
                    filteredExhibitors.map(exhibitor => (
                      <TableRow key={exhibitor.id}>
                        <TableCell><div className="font-bold text-primary">{exhibitor.companyName}</div><div className="text-xs">{exhibitor.firstName} {exhibitor.lastName}</div></TableCell>
                        <TableCell><Badge variant="outline">{exhibitor.requestedTables}</Badge></TableCell>
                        <TableCell>
                          <Badge variant={
                            exhibitor.status === 'pending' ? 'secondary' : 
                            exhibitor.status === 'rejected' ? 'destructive' : 
                            exhibitor.status === 'validated' ? 'default' : 'secondary'
                          }>
                            {exhibitor.status === 'pending' ? 'À étudier' : 
                             exhibitor.status === 'accepted_form1' ? 'Accepté (Attente F2)' : 
                             exhibitor.status === 'submitted_form2' ? 'Dossier Reçu' : 
                             exhibitor.status === 'validated' ? 'Validé' : 'Refusé'}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex justify-end gap-2">
                            <Button variant="outline" size="sm" title="Voir les détails" onClick={() => setViewingExhibitor(exhibitor)} className="text-primary border-primary/30"><Eye className="w-4 h-4" /></Button>
                            
                            <Button size="sm" title="Accepter" className="bg-green-600 hover:bg-green-700" onClick={() => { setActingExhibitor(exhibitor); setIsAcceptDialogOpen(true); }}><CheckCircle className="w-4 h-4" /></Button>
                            <Button variant="destructive" size="sm" title="Refuser" onClick={() => { setActingExhibitor(exhibitor); setIsRejectDialogOpen(true); }}><XCircle className="w-4 h-4" /></Button>

                            {exhibitor.status === 'submitted_form2' && (
                              <Button size="sm" className="bg-blue-600 hover:bg-blue-700" onClick={() => updateDocumentNonBlocking(doc(db, 'pre_registrations', exhibitor.id), { status: 'validated' })}><ShieldCheck className="w-4 h-4 mr-1" /> Valider</Button>
                            )}

                            <AlertDialog>
                              <AlertDialogTrigger asChild><Button variant="outline" size="sm" title="Supprimer" className="text-destructive"><Trash2 className="w-4 h-4" /></Button></AlertDialogTrigger>
                              <AlertDialogContent>
                                <AlertDialogHeader><AlertDialogTitle>Supprimer ?</AlertDialogTitle><AlertDialogDescription>Effacer définitivement le dossier de {exhibitor.companyName}.</AlertDialogDescription></AlertDialogHeader>
                                <AlertDialogFooter><AlertDialogCancel>Annuler</AlertDialogCancel><AlertDialogAction className="bg-destructive" onClick={() => deleteDocumentNonBlocking(doc(db, 'pre_registrations', exhibitor.id))}>Supprimer</AlertDialogAction></AlertDialogFooter>
                              </AlertDialogContent>
                            </AlertDialog>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                </TableBody>
              </Table>
            </Card>
          </TabsContent>

          <TabsContent value="settings" className="space-y-6">
            <Card className="max-w-2xl mx-auto border-t-4 border-t-primary">
              <CardHeader><CardTitle className="text-primary flex items-center gap-2"><Settings className="w-6 h-6" /> Paramètres du Marché</CardTitle></CardHeader>
              <CardContent className="space-y-6">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2"><label className="text-xs font-bold">Année</label><Input type="number" value={configForm.marketYear} onChange={(e) => setConfigForm({...configForm, marketYear: parseInt(e.target.value)})} /></div>
                  <div className="space-y-2"><label className="text-xs font-bold">Édition</label><Input value={configForm.editionNumber} onChange={(e) => setConfigForm({...configForm, editionNumber: e.target.value})} /></div>
                </div>
                <div className="space-y-2"><label className="text-xs font-bold">URL de l'Affiche</label><Input value={configForm.posterImageUrl} onChange={(e) => setConfigForm({...configForm, posterImageUrl: e.target.value})} /></div>
                <div className="space-y-2"><label className="text-xs font-bold">Email Admin</label><Input value={configForm.notificationEmail} onChange={(e) => setConfigForm({...configForm, notificationEmail: e.target.value})} /></div>
                
                <div className="grid grid-cols-2 gap-4 pt-4 border-t">
                  <div className="space-y-2"><label className="text-xs font-bold">Prix 1 Table (€)</label><Input type="number" value={configForm.priceTable1} onChange={(e) => setConfigForm({...configForm, priceTable1: parseInt(e.target.value)})} /></div>
                  <div className="space-y-2"><label className="text-xs font-bold">Prix 2 Tables (€)</label><Input type="number" value={configForm.priceTable2} onChange={(e) => setConfigForm({...configForm, priceTable2: parseInt(e.target.value)})} /></div>
                  <div className="space-y-2"><label className="text-xs font-bold">Prix Repas (€)</label><Input type="number" value={configForm.priceMeal} onChange={(e) => setConfigForm({...configForm, priceMeal: parseInt(e.target.value)})} /></div>
                  <div className="space-y-2"><label className="text-xs font-bold">Option Élec (€)</label><Input type="number" value={configForm.priceElectricity} onChange={(e) => setConfigForm({...configForm, priceElectricity: parseInt(e.target.value)})} /></div>
                </div>

                <div className="pt-4 space-y-4">
                  <Button onClick={handleSaveConfig} className="w-full font-bold">Enregistrer la configuration</Button>
                  <Button onClick={handleTestSmtp} variant="outline" className="w-full border-primary text-primary">Tester la connexion SMTP Gmail</Button>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {isSuperAdmin && (
            <TabsContent value="admins" className="space-y-6">
              {/* Demandes en attente */}
              {adminRequestsList && adminRequestsList.length > 0 && (
                <Card className="max-w-4xl mx-auto border-t-4 border-t-amber-500 shadow-md mb-8">
                  <CardHeader>
                    <CardTitle className="text-amber-600 flex items-center gap-2"><Clock className="w-6 h-6" /> Demandes d'accès en attente</CardTitle>
                    <CardDescription>Approuvez les demandes de connexion des nouveaux collaborateurs.</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="border rounded-lg overflow-hidden">
                      <Table>
                        <TableHeader className="bg-amber-50">
                          <TableRow>
                            <TableHead>Email</TableHead>
                            <TableHead>Date</TableHead>
                            <TableHead className="text-right">Actions</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {adminRequestsList.map(req => (
                            <TableRow key={req.id}>
                              <TableCell className="font-medium">{req.email}</TableCell>
                              <TableCell className="text-xs">{new Date(req.requestedAt).toLocaleDateString()}</TableCell>
                              <TableCell className="text-right">
                                <div className="flex justify-end gap-2">
                                  <Button 
                                    size="sm" 
                                    className="bg-green-600 hover:bg-green-700"
                                    onClick={() => handleApproveRequest(req.id, req.email)}
                                  >
                                    <UserCheck className="w-4 h-4 mr-2" /> Approuver
                                  </Button>
                                  <Button 
                                    size="sm" 
                                    variant="ghost" 
                                    className="text-destructive"
                                    onClick={() => deleteDocumentNonBlocking(doc(db, 'admin_requests', req.id))}
                                  >
                                    Refuser
                                  </Button>
                                </div>
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* Liste des admins actuels */}
              <Card className="max-w-4xl mx-auto border-t-4 border-t-primary">
                <CardHeader>
                  <CardTitle className="text-primary flex items-center gap-2"><Users className="w-6 h-6" /> Administrateurs confirmés</CardTitle>
                  <CardDescription>Utilisateurs ayant un accès complet à la gestion.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                  <div className="border rounded-lg overflow-hidden">
                    <Table>
                      <TableHeader className="bg-muted/50">
                        <TableRow>
                          <TableHead>Email / UID</TableHead>
                          <TableHead>Ajouté le</TableHead>
                          <TableHead className="text-right">Action</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {isAdminsLoading ? (
                          <TableRow><TableCell colSpan={3} className="text-center py-4"><Loader2 className="animate-spin mx-auto" /></TableCell></TableRow>
                        ) : adminsList?.length === 0 ? (
                          <TableRow><TableCell colSpan={3} className="text-center py-4 text-muted-foreground italic">Aucun admin secondaire.</TableCell></TableRow>
                        ) : (
                          adminsList?.map(admin => (
                            <TableRow key={admin.id}>
                              <TableCell>
                                <div className="font-bold">{admin.email || "Utilisateur sans email"}</div>
                                <div className="text-[10px] font-mono text-muted-foreground">{admin.id}</div>
                              </TableCell>
                              <TableCell className="text-xs">{admin.addedAt ? new Date(admin.addedAt).toLocaleDateString() : "Inconnu"}</TableCell>
                              <TableCell className="text-right">
                                <AlertDialog>
                                  <AlertDialogTrigger asChild>
                                    <Button variant="ghost" size="sm" className="text-destructive hover:bg-destructive/10">
                                      <Trash2 className="w-4 h-4" />
                                    </Button>
                                  </AlertDialogTrigger>
                                  <AlertDialogContent>
                                    <AlertDialogHeader>
                                      <AlertDialogTitle>Retirer les accès ?</AlertDialogTitle>
                                      <AlertDialogDescription>
                                        L'utilisateur <strong>{admin.email || admin.id}</strong> n'aura plus accès à cet espace d'administration.
                                      </AlertDialogDescription>
                                    </AlertDialogHeader>
                                    <AlertDialogFooter>
                                      <AlertDialogCancel>Annuler</AlertDialogCancel>
                                      <AlertDialogAction className="bg-destructive" onClick={() => deleteDocumentNonBlocking(doc(db, 'roles_admin', admin.id))}>Confirmer le retrait</AlertDialogAction>
                                    </AlertDialogFooter>
                                  </AlertDialogContent>
                                </AlertDialog>
                              </TableCell>
                            </TableRow>
                          ))
                        )}
                      </TableBody>
                    </Table>
                  </div>

                  <div className="pt-8 border-t">
                    <h4 className="text-sm font-bold mb-4 flex items-center gap-2"><UserPlus className="w-4 h-4" /> Ajout manuel (Expert)</h4>
                    <div className="flex gap-2">
                      <Input 
                        placeholder="Coller l'UID Firebase ici..." 
                        value={newAdminUid} 
                        onChange={(e) => setNewAdminUid(e.target.value)} 
                      />
                      <Button onClick={handleAddAdmin} disabled={isAdminAdding} className="gap-2">
                        {isAdminAdding ? <Loader2 className="animate-spin w-4 h-4" /> : <UserPlus className="w-4 h-4" />}
                        Ajouter par UID
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>
          )}
        </Tabs>
      </main>

      <Dialog open={isAcceptDialogOpen} onOpenChange={setIsAcceptDialogOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Accepter {actingExhibitor?.companyName}</DialogTitle></DialogHeader>
          <div className="py-4 space-y-4">
            <p className="text-sm text-muted-foreground">L'email Gmail contiendra le lien vers le formulaire de finalisation.</p>
            <div className="bg-primary/5 p-3 rounded text-xs italic">
              Le dossier sera validé instantanément en base, l'e-mail suivra en tâche de fond.
            </div>
            <Textarea placeholder="Message personnel (facultatif)..." value={acceptanceMessage} onChange={(e) => setAcceptanceMessage(e.target.value)} rows={4} />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsAcceptDialogOpen(false)}>Annuler</Button>
            <Button onClick={handleAcceptAndSend} disabled={isSending}>{isSending ? <Loader2 className="animate-spin mr-2" /> : <Mail className="w-4 h-4 mr-2" />} Confirmer</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={isRejectDialogOpen} onOpenChange={setIsRejectDialogOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Refuser la candidature</DialogTitle></DialogHeader>
          <div className="py-4 space-y-4">
            <div className="flex flex-wrap gap-2">
              <Button variant="outline" size="sm" onClick={() => handleGenerateRejectIA(["Manque de place"])} disabled={isGenerating}><Sparkles className="w-3 h-3 mr-2" />IA: Place</Button>
              <Button variant="outline" size="sm" onClick={() => handleGenerateRejectIA(["Produits non artisanaux"])} disabled={isGenerating}><Sparkles className="w-3 h-3 mr-2" />IA: Artisanat</Button>
            </div>
            <Textarea value={justification} onChange={(e) => setJustification(e.target.value)} placeholder="Motif du refus..." rows={6} />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsRejectDialogOpen(false)}>Annuler</Button>
            <Button variant="destructive" onClick={handleConfirmReject} disabled={isSending || !justification}>{isSending ? <Loader2 className="animate-spin mr-2" /> : "Envoyer le refus"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!viewingExhibitor} onOpenChange={(open) => !open && setViewingExhibitor(null)}>
        <DialogContent className="max-w-3xl max-h-[90vh]">
          <DialogHeader><DialogTitle className="text-primary flex items-center gap-2"><FileText className="w-6 h-6" /> Dossier de {viewingExhibitor?.companyName}</DialogTitle></DialogHeader>
          <ScrollArea className="pr-4 h-[75vh]">
            {viewingExhibitor && (
              <div className="space-y-8 py-4">
                {/* Informations de contact */}
                <section className="space-y-4">
                  <h4 className="text-xs font-bold uppercase tracking-widest text-primary flex items-center gap-2">
                    <Users className="w-4 h-4" /> Coordonnées du contact
                  </h4>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 bg-muted/30 p-4 rounded-xl">
                    <div className="space-y-1">
                      <p className="text-[10px] font-bold uppercase text-muted-foreground">Responsable</p>
                      <p className="font-bold text-sm">{viewingExhibitor.firstName} {viewingExhibitor.lastName}</p>
                    </div>
                    <div className="space-y-1">
                      <p className="text-[10px] font-bold uppercase text-muted-foreground">E-mail</p>
                      <p className="text-sm flex items-center gap-2">
                        <Mail className="w-3 h-3 text-primary" /> {viewingExhibitor.email}
                      </p>
                    </div>
                    <div className="space-y-1">
                      <p className="text-[10px] font-bold uppercase text-muted-foreground">Téléphone</p>
                      <p className="text-sm flex items-center gap-2">
                        <Phone className="w-3 h-3 text-primary" /> {viewingExhibitor.phone}
                      </p>
                    </div>
                    {viewingExhibitor.websiteUrl && (
                      <div className="space-y-1">
                        <p className="text-[10px] font-bold uppercase text-muted-foreground">Site / Réseaux</p>
                        <a href={viewingExhibitor.websiteUrl} target="_blank" rel="noopener noreferrer" className="text-sm text-primary hover:underline flex items-center gap-2">
                          <Globe className="w-3 h-3" /> Voir le lien <ExternalLink className="w-2 h-2" />
                        </a>
                      </div>
                    )}
                  </div>
                </section>

                {/* Localisation */}
                <section className="space-y-4">
                  <h4 className="text-xs font-bold uppercase tracking-widest text-primary flex items-center gap-2">
                    <MapPin className="w-4 h-4" /> Localisation
                  </h4>
                  <div className="bg-muted/30 p-4 rounded-xl">
                    <p className="text-sm">{viewingExhibitor.address}</p>
                    <p className="text-sm font-bold">{viewingExhibitor.postalCode} {viewingExhibitor.city}</p>
                  </div>
                </section>

                {/* Description du projet */}
                <section className="space-y-4">
                  <h4 className="text-xs font-bold uppercase tracking-widest text-primary flex items-center gap-2">
                    <Sparkles className="w-4 h-4" /> Le Projet
                  </h4>
                  <div className="bg-muted/30 p-4 rounded-xl space-y-3">
                    <div className="flex gap-2">
                      <Badge variant="outline" className="text-[10px]">{viewingExhibitor.isRegistered ? "Professionnel" : "Particulier"}</Badge>
                      <Badge variant="secondary" className="text-[10px]">{viewingExhibitor.requestedTables} table(s)</Badge>
                    </div>
                    <p className="text-sm italic leading-relaxed text-foreground/80">"{viewingExhibitor.productDescription}"</p>
                  </div>
                </section>
                
                {/* Photos des produits */}
                {viewingExhibitor.productImages && viewingExhibitor.productImages.length > 0 && (
                  <section className="space-y-4">
                    <h4 className="text-xs font-bold uppercase tracking-widest text-primary">Photos des produits</h4>
                    <div className="grid grid-cols-3 gap-3">
                      {viewingExhibitor.productImages.map((img, idx) => (
                        <div key={idx} className="relative aspect-square rounded-xl overflow-hidden border shadow-sm group">
                          <img src={img} alt="Produit" className="object-cover w-full h-full transition-transform hover:scale-110" />
                        </div>
                      ))}
                    </div>
                  </section>
                )}

                <Separator />

                {/* Détails techniques si formulaire 2 soumis */}
                {viewingExhibitor.detailedInfo && (
                  <section className="space-y-4 p-5 border-2 border-primary/20 rounded-2xl bg-primary/5">
                    <h4 className="text-sm font-bold text-primary flex items-center gap-2">
                      <ShieldCheck className="w-5 h-5" /> DOSSIER TECHNIQUE FINAL
                    </h4>
                    <div className="grid grid-cols-2 gap-4 text-sm">
                      <div className="space-y-1">
                        <p className="text-[10px] font-bold uppercase text-muted-foreground">Électricité</p>
                        <p className="font-medium">{viewingExhibitor.detailedInfo.needsElectricity ? "Requis" : "Non requis"}</p>
                      </div>
                      <div className="space-y-1">
                        <p className="text-[10px] font-bold uppercase text-muted-foreground">Besoin Grille</p>
                        <p className="font-medium">{viewingExhibitor.detailedInfo.needsGrid ? "Oui" : "Non"}</p>
                      </div>
                      <div className="space-y-1">
                        <p className="text-[10px] font-bold uppercase text-muted-foreground">Repas Dimanche</p>
                        <p className="font-medium">{viewingExhibitor.detailedInfo.sundayLunchCount} plateau(x)</p>
                      </div>
                      <div className="space-y-1">
                        <p className="text-[10px] font-bold uppercase text-muted-foreground">Tombola</p>
                        <p className="font-medium">{viewingExhibitor.detailedInfo.tombolaLot ? "Participant" : "Non"}</p>
                      </div>
                      <div className="col-span-2 space-y-1 border-t pt-2">
                        <p className="text-[10px] font-bold uppercase text-muted-foreground">Assurance RC</p>
                        <p className="font-medium text-xs">{viewingExhibitor.detailedInfo.insuranceCompany} — N°{viewingExhibitor.detailedInfo.insurancePolicyNumber}</p>
                      </div>
                    </div>
                    {viewingExhibitor.detailedInfo.idCardPhoto && (
                      <div className="mt-4 pt-4 border-t">
                        <p className="text-[10px] font-bold uppercase text-muted-foreground mb-2">Pièce d'identité (Recto)</p>
                        <div className="rounded-lg overflow-hidden border max-w-sm">
                          <img src={viewingExhibitor.detailedInfo.idCardPhoto} alt="ID" className="w-full" />
                        </div>
                      </div>
                    )}
                  </section>
                )}
              </div>
            )}
          </ScrollArea>
        </DialogContent>
      </Dialog>
    </div>
  );
}
