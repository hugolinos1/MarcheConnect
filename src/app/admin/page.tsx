
"use client"
import React, { useEffect, useState } from 'react';
import { Exhibitor } from '@/lib/types';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { ChristmasSnow } from '@/components/ChristmasSnow';
import { CheckCircle, XCircle, FileText, Search, Mail, Loader2, Trash2, Eye, ShieldCheck, Sparkles, Download, Settings, Users, ExternalLink, UserCheck, Clock, ArrowLeft, Phone, MapPin, Globe, CreditCard, Heart } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { generateRejectionJustification } from '@/ai/flows/generate-rejection-justification';
import { Textarea } from '@/components/ui/textarea';
import Link from 'next/link';
import { sendAcceptanceEmail, sendRejectionEmail, testSmtpGmail } from '@/app/actions/email-actions';
import { useToast } from '@/hooks/use-toast';
import { useFirestore, useMemoFirebase, useCollection, useUser, useAuth, useDoc } from '@/firebase';
import { collection, doc, query, orderBy, where } from 'firebase/firestore';
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

  const adminsQuery = useMemoFirebase(() => isSuperAdmin ? collection(db, 'roles_admin') : null, [db, isSuperAdmin]);
  const { data: adminsList, isLoading: isAdminsLoading } = useCollection(adminsQuery);

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
    toast({ title: "Demande envoyée" });
    setIsRequestingAccess(false);
  };

  const handleApproveRequest = (requestId: string, requestEmail: string) => {
    setDocumentNonBlocking(doc(db, 'roles_admin', requestId), {
      addedAt: new Date().toISOString(),
      email: requestEmail
    }, { merge: true });
    deleteDocumentNonBlocking(doc(db, 'admin_requests', requestId));
    toast({ title: "Demande approuvée" });
  };

  const handleSaveConfig = () => {
    const configId = selectedConfigId || `config-${configForm.marketYear}`;
    setDocumentNonBlocking(doc(db, 'market_configurations', configId), { ...configForm, id: configId, currentMarket: true }, { merge: true });
    toast({ title: "Paramètres enregistrés" });
  };

  const handleAcceptAndSend = async () => {
    if (!actingExhibitor) return;
    const targetExhibitor = actingExhibitor;
    setIsAcceptDialogOpen(false);
    setIsSending(true);
    updateDocumentNonBlocking(doc(db, 'pre_registrations', targetExhibitor.id), { status: 'accepted_form1' });
    try {
      const result = await sendAcceptanceEmail(targetExhibitor, acceptanceMessage, currentConfig);
      if (result.success) toast({ title: "Candidature acceptée", description: "Email envoyé." });
      else toast({ variant: "destructive", title: "Dossier validé, Email en échec" });
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
      if (result.success) toast({ title: "Candidature refusée", description: "Email envoyé." });
    } finally {
      setIsSending(false);
      setActingExhibitor(null);
      setJustification('');
    }
  };

  const handleTestSmtp = async () => {
    toast({ title: "Test SMTP en cours..." });
    const res = await testSmtpGmail();
    if (res.success) toast({ title: "Test SMTP Réussi" });
    else toast({ variant: "destructive", title: "Test SMTP Échoué", description: res.error });
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
      "Statut": e.status
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
            <CardTitle className="text-primary">{isSigningUp ? "Créer un compte" : "Administration"}</CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleAuth} className="space-y-4">
              <Input type="email" placeholder="Email" value={email} onChange={(e) => setEmail(e.target.value)} required />
              <Input type="password" placeholder="Mot de passe" value={password} onChange={(e) => setPassword(e.target.value)} required />
              {authError && <p className="text-xs text-destructive text-center font-bold">{authError}</p>}
              <Button type="submit" disabled={isAuthLoading} className="w-full">
                {isAuthLoading ? <Loader2 className="animate-spin" /> : (isSigningUp ? "S'inscrire" : "Connexion")}
              </Button>
              <Button type="button" variant="ghost" className="w-full text-xs" onClick={() => setIsSigningUp(!isSigningUp)}>
                {isSigningUp ? "Déjà un compte ? Connectez-vous" : "Pas encore de compte ? Inscrivez-vous"}
              </Button>
            </form>
          </CardContent>
        </Card>
        <Button asChild variant="ghost" className="text-muted-foreground gap-2"><Link href="/"><ArrowLeft className="w-4 h-4" /> Retour à l'accueil</Link></Button>
      </div>
    );
  }

  if (!isAuthorized) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <Card className="max-w-md w-full border-t-4 border-t-amber-500 shadow-xl">
          <CardHeader className="text-center">
            <Clock className="mx-auto w-12 h-12 text-amber-600 mb-4 animate-pulse" />
            <CardTitle className="text-amber-600">Accès restreint</CardTitle>
            <CardDescription>Votre compte ({user.email}) n'est pas encore autorisé.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {pendingRequest ? (
              <Alert className="bg-amber-50 border-amber-200"><AlertTitle>Demande en cours</AlertTitle><AlertDescription>L'administrateur principal doit valider votre accès.</AlertDescription></Alert>
            ) : (
              <Button onClick={handleRequestAccess} disabled={isRequestingAccess} className="w-full bg-primary gap-2">Demander l'accès</Button>
            )}
            <div className="flex flex-col gap-2">
              <Button onClick={() => auth.signOut()} variant="outline" className="w-full">Se déconnecter</Button>
              <Button asChild variant="ghost" className="w-full"><Link href="/">Retour à l'accueil</Link></Button>
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
            <Button onClick={() => auth.signOut()} variant="ghost" size="sm" className="text-white">Déconnexion</Button>
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
                          <Badge variant={exhibitor.status === 'pending' ? 'secondary' : exhibitor.status === 'rejected' ? 'destructive' : exhibitor.status === 'validated' ? 'default' : 'secondary'}>
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
                              <AlertDialogTrigger asChild><Button variant="outline" size="sm" className="text-destructive"><Trash2 className="w-4 h-4" /></Button></AlertDialogTrigger>
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
              <CardHeader><CardTitle className="text-primary flex items-center gap-2"><Settings className="w-6 h-6" /> Configuration</CardTitle></CardHeader>
              <CardContent className="space-y-6">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2"><label className="text-xs font-bold">Année</label><Input type="number" value={configForm.marketYear} onChange={(e) => setConfigForm({...configForm, marketYear: parseInt(e.target.value)})} /></div>
                  <div className="space-y-2"><label className="text-xs font-bold">Édition</label><Input value={configForm.editionNumber} onChange={(e) => setConfigForm({...configForm, editionNumber: e.target.value})} /></div>
                </div>
                <div className="space-y-2"><label className="text-xs font-bold">URL Affiche</label><Input value={configForm.posterImageUrl} onChange={(e) => setConfigForm({...configForm, posterImageUrl: e.target.value})} /></div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2"><label className="text-xs font-bold">Prix 1 Table</label><Input type="number" value={configForm.priceTable1} onChange={(e) => setConfigForm({...configForm, priceTable1: parseInt(e.target.value)})} /></div>
                  <div className="space-y-2"><label className="text-xs font-bold">Prix 2 Tables</label><Input type="number" value={configForm.priceTable2} onChange={(e) => setConfigForm({...configForm, priceTable2: parseInt(e.target.value)})} /></div>
                </div>
                <Button onClick={handleSaveConfig} className="w-full font-bold">Enregistrer</Button>
                <Button onClick={handleTestSmtp} variant="outline" className="w-full">Tester Gmail</Button>
              </CardContent>
            </Card>
          </TabsContent>

          {isSuperAdmin && (
            <TabsContent value="admins" className="space-y-6">
              {adminRequestsList && adminRequestsList.length > 0 && (
                <Card className="border-t-4 border-t-amber-500 mb-8">
                  <CardHeader><CardTitle className="text-amber-600">Demandes d'accès en attente</CardTitle></CardHeader>
                  <CardContent>
                    <Table>
                      <TableBody>
                        {adminRequestsList.map(req => (
                          <TableRow key={req.id}>
                            <TableCell className="font-medium">{req.email}</TableCell>
                            <TableCell className="text-right"><Button size="sm" className="bg-green-600 hover:bg-green-700" onClick={() => handleApproveRequest(req.id, req.email)}><UserCheck className="w-4 h-4 mr-2" /> Approuver</Button></TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </CardContent>
                </Card>
              )}
              <Card className="border-t-4 border-t-primary">
                <CardHeader><CardTitle className="text-primary">Administrateurs confirmés</CardTitle></CardHeader>
                <CardContent className="space-y-6">
                  <Table>
                    <TableBody>
                      {adminsList?.map(admin => (
                        <TableRow key={admin.id}>
                          <TableCell><div className="font-bold">{admin.email}</div><div className="text-[10px] text-muted-foreground font-mono">{admin.id}</div></TableCell>
                          <TableCell className="text-right"><Button variant="ghost" size="sm" className="text-destructive" onClick={() => deleteDocumentNonBlocking(doc(db, 'roles_admin', admin.id))}><Trash2 className="w-4 h-4" /></Button></TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
            </TabsContent>
          )}
        </Tabs>
      </main>

      <Dialog open={!!viewingExhibitor} onOpenChange={(open) => !open && setViewingExhibitor(null)}>
        <DialogContent className="max-w-4xl max-h-[90vh]">
          <DialogHeader><DialogTitle className="text-primary flex items-center gap-2"><FileText className="w-6 h-6" /> Dossier de {viewingExhibitor?.companyName}</DialogTitle></DialogHeader>
          <ScrollArea className="pr-4 h-[75vh]">
            {viewingExhibitor && (
              <div className="space-y-8 py-4">
                <section className="space-y-4">
                  <h4 className="text-xs font-bold uppercase tracking-widest text-primary flex items-center gap-2"><Users className="w-4 h-4" /> Coordonnées</h4>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 bg-muted/30 p-4 rounded-xl">
                    <div className="space-y-1"><p className="text-[10px] font-bold text-muted-foreground uppercase">Responsable</p><p className="font-bold text-sm">{viewingExhibitor.firstName} {viewingExhibitor.lastName}</p></div>
                    <div className="space-y-1"><p className="text-[10px] font-bold text-muted-foreground uppercase">E-mail</p><p className="text-sm flex items-center gap-2"><Mail className="w-3 h-3 text-primary" /> {viewingExhibitor.email}</p></div>
                    <div className="space-y-1"><p className="text-[10px] font-bold text-muted-foreground uppercase">Téléphone</p><p className="text-sm flex items-center gap-2"><Phone className="w-3 h-3 text-primary" /> {viewingExhibitor.phone}</p></div>
                    {viewingExhibitor.websiteUrl && (
                      <div className="space-y-1">
                        <p className="text-[10px] font-bold text-muted-foreground uppercase">Site / Réseaux</p>
                        <a href={viewingExhibitor.websiteUrl} target="_blank" rel="noopener noreferrer" className="text-sm text-primary hover:underline flex items-center gap-2 break-all">
                          <Globe className="w-3 h-3 shrink-0" /> 
                          {viewingExhibitor.websiteUrl} 
                          <ExternalLink className="w-2 h-2 shrink-0" />
                        </a>
                      </div>
                    )}
                  </div>
                </section>
                <section className="space-y-4">
                  <h4 className="text-xs font-bold uppercase tracking-widest text-primary flex items-center gap-2"><MapPin className="w-4 h-4" /> Localisation</h4>
                  <div className="bg-muted/30 p-4 rounded-xl">
                    <p className="text-sm">{viewingExhibitor.address}</p>
                    <p className="text-sm font-bold">{viewingExhibitor.postalCode} {viewingExhibitor.city}</p>
                  </div>
                </section>
                <section className="space-y-4">
                  <h4 className="text-xs font-bold uppercase tracking-widest text-primary flex items-center gap-2"><Sparkles className="w-4 h-4" /> Projet</h4>
                  <div className="bg-muted/30 p-4 rounded-xl space-y-3">
                    <p className="text-sm italic leading-relaxed">"{viewingExhibitor.productDescription}"</p>
                  </div>
                </section>

                {viewingExhibitor.productImages && (
                  <section className="space-y-4">
                    <h4 className="text-xs font-bold uppercase tracking-widest text-primary">Photos Produits (Préinscription)</h4>
                    <div className="grid grid-cols-3 gap-3">
                      {viewingExhibitor.productImages.map((img, idx) => (
                        <div key={idx} className="relative aspect-square rounded-xl overflow-hidden border shadow-sm"><img src={img} alt="Produit" className="object-cover w-full h-full" /></div>
                      ))}
                    </div>
                  </section>
                )}

                {viewingExhibitor.detailedInfo && (
                  <section className="space-y-6 p-6 border-2 border-primary/20 rounded-2xl bg-primary/5">
                    <h4 className="text-lg font-bold text-primary flex items-center gap-2 border-b border-primary/10 pb-2"><ShieldCheck className="w-6 h-6" /> DOSSIER TECHNIQUE FINAL</h4>
                    
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <div className="space-y-4">
                        <h5 className="text-[10px] font-bold uppercase tracking-widest text-primary/70 flex items-center gap-1"><CreditCard className="w-3 h-3" /> Administratif</h5>
                        <div className="space-y-2 text-sm">
                          {viewingExhibitor.detailedInfo.siret && (
                            <div className="flex justify-between border-b border-primary/5 pb-1">
                              <span className="text-muted-foreground">SIRET :</span>
                              <span className="font-medium">{viewingExhibitor.detailedInfo.siret}</span>
                            </div>
                          )}
                          <div className="flex justify-between border-b border-primary/5 pb-1">
                            <span className="text-muted-foreground">Assurance :</span>
                            <span className="font-medium">{viewingExhibitor.detailedInfo.insuranceCompany}</span>
                          </div>
                          <div className="flex justify-between border-b border-primary/5 pb-1">
                            <span className="text-muted-foreground">N° Contrat :</span>
                            <span className="font-medium">{viewingExhibitor.detailedInfo.insurancePolicyNumber}</span>
                          </div>
                        </div>
                      </div>

                      <div className="space-y-4">
                        <h5 className="text-[10px] font-bold uppercase tracking-widest text-primary/70 flex items-center gap-1"><Settings className="w-3 h-3" /> Options</h5>
                        <div className="space-y-2 text-sm">
                          <div className="flex justify-between border-b border-primary/5 pb-1">
                            <span className="text-muted-foreground">Électricité :</span>
                            <Badge variant={viewingExhibitor.detailedInfo.needsElectricity ? 'default' : 'outline'}>{viewingExhibitor.detailedInfo.needsElectricity ? "Oui" : "Non"}</Badge>
                          </div>
                          <div className="flex justify-between border-b border-primary/5 pb-1">
                            <span className="text-muted-foreground">Grille Expo :</span>
                            <Badge variant={viewingExhibitor.detailedInfo.needsGrid ? 'default' : 'outline'}>{viewingExhibitor.detailedInfo.needsGrid ? "Oui" : "Non"}</Badge>
                          </div>
                          <div className="flex justify-between border-b border-primary/5 pb-1">
                            <span className="text-muted-foreground">Plateaux Repas :</span>
                            <span className="font-bold">{viewingExhibitor.detailedInfo.sundayLunchCount}</span>
                          </div>
                          <div className="flex justify-between border-b border-primary/5 pb-1">
                            <span className="text-muted-foreground">Tombola :</span>
                            <Badge variant={viewingExhibitor.detailedInfo.tombolaLot ? 'secondary' : 'outline'}>{viewingExhibitor.detailedInfo.tombolaLot ? "Oui" : "Non"}</Badge>
                          </div>
                        </div>
                      </div>
                    </div>

                    {viewingExhibitor.detailedInfo.tombolaLotDescription && (
                      <div className="space-y-2 bg-white/50 p-3 rounded-lg border border-primary/10">
                        <p className="text-[10px] font-bold text-primary/70 uppercase">Lot Tombola</p>
                        <p className="text-sm italic">"{viewingExhibitor.detailedInfo.tombolaLotDescription}"</p>
                      </div>
                    )}

                    {viewingExhibitor.detailedInfo.idCardPhoto && (
                      <div className="space-y-2">
                        <p className="text-[10px] font-bold text-primary/70 uppercase">Pièce d'identité (Recto)</p>
                        <div className="relative aspect-video max-w-sm rounded-lg overflow-hidden border-2 border-white shadow-md">
                          <img src={viewingExhibitor.detailedInfo.idCardPhoto} alt="ID Card" className="object-cover w-full h-full" />
                        </div>
                      </div>
                    )}

                    {viewingExhibitor.detailedInfo.additionalComments && (
                      <div className="space-y-2">
                        <p className="text-[10px] font-bold text-primary/70 uppercase">Commentaires</p>
                        <div className="bg-white/50 p-3 rounded-lg text-sm leading-relaxed">
                          {viewingExhibitor.detailedInfo.additionalComments}
                        </div>
                      </div>
                    )}

                    <div className="flex flex-wrap gap-4 pt-4 border-t border-primary/10">
                      <div className="flex items-center gap-2 text-[10px] font-bold text-primary/60">
                         <Heart className="w-3 h-3 text-secondary" /> DROIT IMAGE : {viewingExhibitor.detailedInfo.agreedToImageRights ? "ACCEPTÉ" : "REFUSÉ"}
                      </div>
                      <div className="flex items-center gap-2 text-[10px] font-bold text-primary/60">
                         <FileText className="w-3 h-3 text-secondary" /> RÈGLEMENT : {viewingExhibitor.detailedInfo.agreedToTerms ? "ACCEPTÉ" : "REFUSÉ"}
                      </div>
                    </div>
                  </section>
                )}
              </div>
            )}
          </ScrollArea>
        </DialogContent>
      </Dialog>

      <Dialog open={isAcceptDialogOpen} onOpenChange={setIsAcceptDialogOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Accepter {actingExhibitor?.companyName}</DialogTitle></DialogHeader>
          <div className="py-4 space-y-4"><Textarea placeholder="Message personnel..." value={acceptanceMessage} onChange={(e) => setAcceptanceMessage(e.target.value)} rows={4} /></div>
          <DialogFooter><Button onClick={handleAcceptAndSend} disabled={isSending}>{isSending ? <Loader2 className="animate-spin" /> : <Mail className="w-4 h-4 mr-2" />} Confirmer</Button></DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={isRejectDialogOpen} onOpenChange={setIsRejectDialogOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Refuser la candidature</DialogTitle></DialogHeader>
          <div className="py-4 space-y-4">
            <div className="flex flex-wrap gap-2">
              <Button variant="outline" size="sm" onClick={() => handleGenerateRejectIA(["Manque de place"])}><Sparkles className="w-3 h-3 mr-2" />Place</Button>
              <Button variant="outline" size="sm" onClick={() => handleGenerateRejectIA(["Produits non artisanaux"])}><Sparkles className="w-3 h-3 mr-2" />Artisanat</Button>
            </div>
            <Textarea value={justification} onChange={(e) => setJustification(e.target.value)} placeholder="Motif..." rows={6} />
          </div>
          <DialogFooter><Button variant="destructive" onClick={handleConfirmReject} disabled={isSending || !justification}>Envoyer</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
