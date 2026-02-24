
"use client"
import React, { useEffect, useState, useMemo } from 'react';
import { Exhibitor } from '@/lib/types';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { ChristmasSnow } from '@/components/ChristmasSnow';
import { CheckCircle, XCircle, FileText, Search, Mail, Loader2, Trash2, Eye, ShieldCheck, Sparkles, Download, Settings, Users, ExternalLink, UserCheck, Clock, ArrowLeft, Phone, MapPin, Globe, CreditCard, Heart, TrendingUp, Wallet, ClipboardList, Filter, LayoutGrid, Info, Camera, MessageSquare } from 'lucide-react';
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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
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

  const logoUrl = "https://i.ibb.co/yncRPkvR/logo-ujpf.jpg";

  const isSuperAdmin = user?.email === "hugues.rabier@gmail.com";

  // Auth check
  const userRoleRef = useMemoFirebase(() => user ? doc(db, 'roles_admin', user.uid) : null, [db, user]);
  const { data: userRoleDoc, isLoading: isRoleLoading } = useDoc(userRoleRef);
  const isAuthorized = isSuperAdmin || !!userRoleDoc;

  // Admin Requests for SuperAdmin
  const adminRequestsQuery = useMemoFirebase(() => isSuperAdmin ? collection(db, 'admin_requests') : null, [db, isSuperAdmin]);
  const { data: adminRequests } = useCollection(adminRequestsQuery);

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

  // Exhibitors Data
  const exhibitorsQuery = useMemoFirebase(() => {
    if (!isAuthorized || !selectedConfigId) return null;
    return query(collection(db, 'pre_registrations'), where('marketConfigurationId', '==', selectedConfigId));
  }, [db, isAuthorized, selectedConfigId]);
  
  const { data: exhibitorsData, isLoading: isExhibitorsLoading } = useCollection<Exhibitor>(exhibitorsQuery);

  // Statistics
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

  // Form Config
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

  const filteredExhibitors = useMemo(() => {
    if (!exhibitorsData) return [];
    return exhibitorsData.filter(e => 
      e.companyName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      `${e.firstName} ${e.lastName}`.toLowerCase().includes(searchTerm.toLowerCase())
    );
  }, [exhibitorsData, searchTerm]);

  const handleAuth = (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError('');
    setIsAuthLoading(true);
    const authPromise = isSigningUp 
      ? initiateEmailSignUp(auth, email, password)
      : initiateEmailSignIn(auth, email, password);
    authPromise.catch((err: any) => setAuthError("Erreur d'authentification.")).finally(() => setIsAuthLoading(false));
  };

  const handleRequestAccess = () => {
    if (!user) return;
    setDocumentNonBlocking(doc(db, 'admin_requests', user.uid), {
      email: user.email,
      requestedAt: new Date().toISOString(),
      status: 'PENDING'
    }, { merge: true });
    toast({ title: "Demande envoyée", description: "Le super-admin va examiner votre demande." });
  };

  const handleApproveRequest = (requestId: string, requestEmail: string) => {
    setDocumentNonBlocking(doc(db, 'roles_admin', requestId), { addedAt: new Date().toISOString(), email: requestEmail }, { merge: true });
    deleteDocumentNonBlocking(doc(db, 'admin_requests', requestId));
    toast({ title: "Accès autorisé" });
  };

  const handleSaveConfig = () => {
    const configId = `config-${configForm.marketYear}`;
    setDocumentNonBlocking(doc(db, 'market_configurations', configId), { ...configForm, id: configId, currentMarket: true }, { merge: true });
    toast({ title: "Paramètres mis à jour" });
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
      "Total Estimé": (e.status === 'submitted_form2' || e.status === 'validated') ? 
        ((e.requestedTables === '1' ? (currentConfig?.priceTable1 ?? 40) : (currentConfig?.priceTable2 ?? 60)) + 
        ((e.detailedInfo?.sundayLunchCount || 0) * (currentConfig?.priceMeal ?? 8)) + 
        (e.detailedInfo?.needsElectricity ? (currentConfig?.priceElectricity ?? 1) : 0)) : 0
    }));
    const worksheet = XLSX.utils.json_to_sheet(exportData);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Exposants");
    XLSX.writeFile(workbook, `Marché_${currentConfig?.marketYear}_Export.xlsx`);
  };

  if (isUserLoading || isRoleLoading) return <div className="min-h-screen flex items-center justify-center"><Loader2 className="animate-spin text-primary" /></div>;

  if (!user) {
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center p-4">
        <Card className="max-w-md w-full border-t-4 border-t-primary shadow-xl mb-4">
          <CardHeader className="text-center"><CardTitle className="text-primary">{isSigningUp ? "Créer un compte" : "Administration"}</CardTitle></CardHeader>
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
        <Button asChild variant="ghost" className="text-muted-foreground gap-2"><Link href="/"><ArrowLeft className="w-4 h-4" /> Retour au site</Link></Button>
      </div>
    );
  }

  if (!isAuthorized) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <Card className="max-w-md w-full border-t-4 border-t-amber-500 shadow-xl p-8 text-center space-y-6">
          <Clock className="mx-auto w-12 h-12 text-amber-500 animate-pulse" />
          <div className="space-y-2">
            <h2 className="text-xl font-bold">Accès en attente</h2>
            <p className="text-sm text-muted-foreground">Votre compte ({user.email}) doit être approuvé par l'administrateur principal.</p>
          </div>
          <Button onClick={handleRequestAccess} className="w-full bg-amber-500 hover:bg-amber-600">Demander l'accès administrateur</Button>
          <Button onClick={() => auth.signOut()} variant="outline" className="w-full">Se déconnecter</Button>
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
            <h1 className="text-lg font-bold hidden md:block">Tableau de Bord : {currentConfig?.marketYear}</h1>
          </div>
          <div className="flex gap-2">
            <Button asChild variant="secondary" size="sm" className="font-bold"><Link href="/">Site Public</Link></Button>
            <Button onClick={() => auth.signOut()} variant="ghost" size="sm" className="text-white">Quitter</Button>
          </div>
        </div>
      </div>

      <main className="container mx-auto px-4 py-8 space-y-8">
        {/* Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Card className="border-l-4 border-l-primary shadow-sm">
            <CardContent className="p-4 flex items-center gap-4">
              <div className="p-3 bg-primary/10 rounded-full text-primary"><ClipboardList className="w-6 h-6" /></div>
              <div><p className="text-xs text-muted-foreground font-bold uppercase">Total</p><p className="text-2xl font-bold">{stats.total}</p></div>
            </CardContent>
          </Card>
          <Card className="border-l-4 border-l-amber-500 shadow-sm">
            <CardContent className="p-4 flex items-center gap-4">
              <div className="p-3 bg-amber-500/10 rounded-full text-amber-600"><Clock className="w-6 h-6" /></div>
              <div><p className="text-xs text-muted-foreground font-bold uppercase">À Étudier</p><p className="text-2xl font-bold">{stats.pending}</p></div>
            </CardContent>
          </Card>
          <Card className="border-l-4 border-l-green-600 shadow-sm">
            <CardContent className="p-4 flex items-center gap-4">
              <div className="p-3 bg-green-600/10 rounded-full text-green-600"><TrendingUp className="w-6 h-6" /></div>
              <div><p className="text-xs text-muted-foreground font-bold uppercase">Confirmés</p><p className="text-2xl font-bold">{stats.submitted + stats.validated}</p></div>
            </CardContent>
          </Card>
          <Card className="border-l-4 border-l-secondary shadow-sm">
            <CardContent className="p-4 flex items-center gap-4">
              <div className="p-3 bg-secondary/10 rounded-full text-secondary"><Wallet className="w-6 h-6" /></div>
              <div><p className="text-xs text-muted-foreground font-bold uppercase">Recettes</p><p className="text-2xl font-bold text-secondary">{stats.revenue}€</p></div>
            </CardContent>
          </Card>
        </div>

        <Tabs defaultValue="exhibitors">
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-6">
            <TabsList>
              <TabsTrigger value="exhibitors">Exposants</TabsTrigger>
              <TabsTrigger value="settings">Configuration</TabsTrigger>
              {isSuperAdmin && <TabsTrigger value="admins">Administrateurs</TabsTrigger>}
            </TabsList>
            
            <div className="flex items-center gap-3 w-full md:w-auto">
              <Filter className="w-4 h-4 text-muted-foreground shrink-0" />
              <Select value={selectedConfigId} onValueChange={setSelectedConfigId}>
                <SelectTrigger className="w-[180px] bg-white">
                  <SelectValue placeholder="Choisir une édition" />
                </SelectTrigger>
                <SelectContent>
                  {configs?.map(config => (
                    <SelectItem key={config.id} value={config.id}>Édition {config.marketYear}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <TabsContent value="exhibitors" className="space-y-6">
            <div className="flex flex-col md:flex-row gap-4 items-center">
              <div className="relative flex-1 w-full">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input placeholder="Rechercher par enseigne ou nom..." className="pl-10 bg-white" value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} />
              </div>
              <Button onClick={handleExportExcel} variant="outline" className="gap-2 text-primary font-bold bg-white"><Download className="w-4 h-4" /> Export Excel</Button>
            </div>

            <Card className="overflow-hidden border-2 bg-white">
              <Table>
                <TableHeader className="bg-muted/30">
                  <TableRow><TableHead>Exposant / Enseigne</TableHead><TableHead>Tables</TableHead><TableHead>Statut</TableHead><TableHead className="text-right">Actions</TableHead></TableRow>
                </TableHeader>
                <TableBody>
                  {isExhibitorsLoading ? <TableRow><TableCell colSpan={4} className="text-center py-12"><Loader2 className="animate-spin mx-auto text-primary" /></TableCell></TableRow> :
                    filteredExhibitors.length === 0 ? <TableRow><TableCell colSpan={4} className="text-center py-12 text-muted-foreground italic">Aucun dossier trouvé.</TableCell></TableRow> :
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
                            {exhibitor.status === 'pending' ? 'À l\'étude' : 
                             exhibitor.status === 'accepted_form1' ? 'Accepté (F1)' : 
                             exhibitor.status === 'submitted_form2' ? 'Dossier Reçu' : 
                             exhibitor.status === 'validated' ? 'Confirmé' : 'Refusé'}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex justify-end gap-2">
                            <Button variant="outline" size="sm" onClick={() => setViewingExhibitor(exhibitor)} className="text-primary border-primary/20"><Eye className="w-4 h-4" /></Button>
                            {exhibitor.status === 'pending' && (
                              <div className="flex gap-1">
                                <Button size="sm" className="bg-green-600 hover:bg-green-700" onClick={() => { setActingExhibitor(exhibitor); setIsAcceptDialogOpen(true); }}><CheckCircle className="w-4 h-4" /></Button>
                                <Button size="sm" variant="destructive" onClick={() => { setActingExhibitor(exhibitor); setIsRejectDialogOpen(true); }}><XCircle className="w-4 h-4" /></Button>
                              </div>
                            )}
                            {exhibitor.status === 'submitted_form2' && (
                              <Button size="sm" className="bg-blue-600 hover:bg-blue-700" onClick={() => updateDocumentNonBlocking(doc(db, 'pre_registrations', exhibitor.id), { status: 'validated' })}><ShieldCheck className="w-4 h-4 mr-1" /> Valider</Button>
                            )}
                            <AlertDialog>
                              <AlertDialogTrigger asChild><Button variant="outline" size="sm" className="text-destructive border-destructive/20"><Trash2 className="w-4 h-4" /></Button></AlertDialogTrigger>
                              <AlertDialogContent>
                                <AlertDialogHeader><AlertDialogTitle>Suppression définitive</AlertDialogTitle><AlertDialogDescription>Êtes-vous sûr de vouloir supprimer le dossier de {exhibitor.companyName} ?</AlertDialogDescription></AlertDialogHeader>
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
            <Card className="max-w-2xl mx-auto border-t-4 border-t-primary bg-white shadow-xl">
              <CardHeader><CardTitle className="text-primary flex items-center gap-2"><Settings className="w-6 h-6" /> Configuration de l'édition</CardTitle></CardHeader>
              <CardContent className="space-y-6">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2"><label className="text-xs font-bold uppercase text-muted-foreground">Année</label><Input type="number" value={configForm.marketYear} onChange={(e) => setConfigForm({...configForm, marketYear: parseInt(e.target.value)})} /></div>
                  <div className="space-y-2"><label className="text-xs font-bold uppercase text-muted-foreground">Nom Édition</label><Input value={configForm.editionNumber} onChange={(e) => setConfigForm({...configForm, editionNumber: e.target.value})} /></div>
                </div>
                <div className="space-y-2"><label className="text-xs font-bold uppercase text-muted-foreground">E-mail Notifications Admin</label><Input type="email" value={configForm.notificationEmail} onChange={(e) => setConfigForm({...configForm, notificationEmail: e.target.value})} /></div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2"><label className="text-xs font-bold uppercase text-muted-foreground">Prix 1 Table</label><Input type="number" value={configForm.priceTable1} onChange={(e) => setConfigForm({...configForm, priceTable1: parseInt(e.target.value)})} /></div>
                  <div className="space-y-2"><label className="text-xs font-bold uppercase text-muted-foreground">Prix 2 Tables</label><Input type="number" value={configForm.priceTable2} onChange={(e) => setConfigForm({...configForm, priceTable2: parseInt(e.target.value)})} /></div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2"><label className="text-xs font-bold uppercase text-muted-foreground">Prix Repas</label><Input type="number" value={configForm.priceMeal} onChange={(e) => setConfigForm({...configForm, priceMeal: parseInt(e.target.value)})} /></div>
                  <div className="space-y-2"><label className="text-xs font-bold uppercase text-muted-foreground">Prix Élec</label><Input type="number" value={configForm.priceElectricity} onChange={(e) => setConfigForm({...configForm, priceElectricity: parseInt(e.target.value)})} /></div>
                </div>
                <Button onClick={handleSaveConfig} className="w-full font-bold h-12">Mettre à jour cette édition</Button>
                <Separator />
                <Button onClick={() => testSmtpGmail().then(r => toast({ title: r.success ? "Gmail OK" : "Erreur Gmail", variant: r.success ? "default" : "destructive" }))} variant="outline" className="w-full">Tester la connexion Gmail</Button>
              </CardContent>
            </Card>
          </TabsContent>

          {isSuperAdmin && (
            <TabsContent value="admins" className="space-y-6">
              <Card className="border-t-4 border-t-primary bg-white shadow-xl">
                <CardHeader><CardTitle className="text-primary flex items-center gap-2"><Users className="w-6 h-6" /> Demandes d'accès & Administrateurs</CardTitle></CardHeader>
                <CardContent className="space-y-8">
                  <div className="space-y-4">
                    <h3 className="text-sm font-bold uppercase tracking-wider text-muted-foreground">Demandes en attente</h3>
                    {adminRequests && adminRequests.length > 0 ? (
                      <div className="space-y-2">
                        {adminRequests.map(req => (
                          <div key={req.id} className="flex justify-between items-center p-4 bg-amber-50 rounded-xl border border-amber-200">
                            <div><p className="font-bold">{req.email}</p><p className="text-xs text-muted-foreground">Demandé le {new Date(req.requestedAt).toLocaleDateString()}</p></div>
                            <Button onClick={() => handleApproveRequest(req.id, req.email)} className="bg-green-600 hover:bg-green-700 gap-2"><UserCheck className="w-4 h-4" /> Approuver</Button>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="text-sm italic text-muted-foreground">Aucune demande en attente.</p>
                    )}
                  </div>
                  
                  <Separator />
                  
                  <div className="space-y-4">
                    <h3 className="text-sm font-bold uppercase tracking-wider text-muted-foreground">Administrateurs actuels</h3>
                    <p className="text-xs italic text-muted-foreground">Géré via la collection 'roles_admin'.</p>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>
          )}
        </Tabs>
      </main>

      {/* Viewing Dialog */}
      <Dialog open={!!viewingExhibitor} onOpenChange={(o) => !o && setViewingExhibitor(null)}>
        <DialogContent className="max-w-4xl max-h-[90vh]">
          <DialogHeader><DialogTitle className="text-primary flex items-center gap-2"><FileText className="w-6 h-6" /> Dossier de {viewingExhibitor?.companyName}</DialogTitle></DialogHeader>
          <ScrollArea className="h-[70vh] pr-4">
            {viewingExhibitor && (
              <div className="space-y-8 py-4">
                <section className="grid grid-cols-1 md:grid-cols-2 gap-6 bg-muted/30 p-6 rounded-2xl">
                  <div className="space-y-4">
                    <h4 className="text-[10px] font-bold uppercase tracking-widest text-primary/70">Coordonnées</h4>
                    <div className="space-y-2 text-sm">
                      <p className="font-bold">{viewingExhibitor.firstName} {viewingExhibitor.lastName}</p>
                      <p className="flex items-center gap-2"><Mail className="w-3 h-3 text-primary" /> {viewingExhibitor.email}</p>
                      <p className="flex items-center gap-2"><Phone className="w-3 h-3 text-primary" /> {viewingExhibitor.phone}</p>
                      <p className="flex items-center gap-2 font-bold text-secondary">
                        <LayoutGrid className="w-3 h-3" /> 
                        Emplacement : {viewingExhibitor.requestedTables === '1' ? '1 table (1.75m)' : '2 tables (3.50m)'}
                      </p>
                      {viewingExhibitor.websiteUrl && (
                        <p className="flex items-center gap-2 text-primary hover:underline">
                          <Globe className="w-3 h-3" /> 
                          <a href={viewingExhibitor.websiteUrl} target="_blank" className="break-all">{viewingExhibitor.websiteUrl}</a>
                        </p>
                      )}
                    </div>
                  </div>
                  <div className="space-y-4">
                    <h4 className="text-[10px] font-bold uppercase tracking-widest text-primary/70">Adresse</h4>
                    <div className="space-y-1 text-sm">
                      <p>{viewingExhibitor.address}</p>
                      <p className="font-bold">{viewingExhibitor.postalCode} {viewingExhibitor.city}</p>
                    </div>
                  </div>
                </section>

                <section className="space-y-4">
                  <h4 className="text-[10px] font-bold uppercase tracking-widest text-primary/70">Projet & Produits</h4>
                  <div className="bg-primary/5 p-4 rounded-xl border border-primary/10">
                    <p className="text-sm italic leading-relaxed">"{viewingExhibitor.productDescription}"</p>
                  </div>
                  {viewingExhibitor.productImages && viewingExhibitor.productImages.length > 0 && (
                    <div className="grid grid-cols-3 gap-3">
                      {viewingExhibitor.productImages.map((img, i) => (
                        <div key={i} className="relative aspect-square rounded-lg overflow-hidden border shadow-sm group">
                          <img src={img} alt="Produit" className="object-cover w-full h-full cursor-pointer hover:scale-105 transition-transform" />
                        </div>
                      ))}
                    </div>
                  )}
                </section>

                {viewingExhibitor.detailedInfo ? (
                  <section className="space-y-6 p-6 border-2 border-primary/20 rounded-2xl bg-white shadow-inner">
                    <h4 className="text-lg font-bold text-primary flex items-center gap-2 border-b pb-2">
                      <ShieldCheck className="w-5 h-5" /> DOSSIER TECHNIQUE FINAL
                    </h4>
                    
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                      <div className="space-y-6">
                        <div className="space-y-2">
                          <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Informations Légales</p>
                          <div className="space-y-1">
                            <p className="text-sm font-bold">SIRET : <span className="font-normal">{viewingExhibitor.detailedInfo.siret || "Non renseigné"}</span></p>
                            <p className="text-sm font-bold">Assurance : <span className="font-normal">{viewingExhibitor.detailedInfo.insuranceCompany}</span></p>
                            <p className="text-sm font-bold">Contrat N° : <span className="font-normal">{viewingExhibitor.detailedInfo.insurancePolicyNumber}</span></p>
                          </div>
                        </div>

                        <div className="space-y-2">
                          <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Pièce d'identité</p>
                          {viewingExhibitor.detailedInfo.idCardPhoto ? (
                            <div className="relative aspect-video max-w-xs rounded-lg overflow-hidden border bg-muted">
                              <img src={viewingExhibitor.detailedInfo.idCardPhoto} alt="ID Card" className="w-full h-full object-contain" />
                            </div>
                          ) : (
                            <p className="text-xs italic text-destructive">Document manquant</p>
                          )}
                        </div>

                        <div className="space-y-2">
                          <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Options Logistiques</p>
                          <div className="flex flex-wrap gap-2">
                            <Badge variant={viewingExhibitor.detailedInfo.needsElectricity ? "default" : "outline"}>
                              Électricité : {viewingExhibitor.detailedInfo.needsElectricity ? "OUI" : "NON"}
                            </Badge>
                            <Badge variant={viewingExhibitor.detailedInfo.needsGrid ? "default" : "outline"}>
                              Besoin Grille : {viewingExhibitor.detailedInfo.needsGrid ? "OUI" : "NON"}
                            </Badge>
                          </div>
                        </div>
                      </div>

                      <div className="space-y-6">
                        <div className="space-y-2">
                          <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Restauration & Tombola</p>
                          <div className="space-y-3">
                            <p className="text-sm font-bold">Repas Dimanche : <Badge variant="secondary">{viewingExhibitor.detailedInfo.sundayLunchCount} plateau(x)</Badge></p>
                            <div className="p-3 bg-muted/20 rounded-lg border">
                              <p className="text-xs font-bold mb-1">Tombola Solidaire : {viewingExhibitor.detailedInfo.tombolaLot ? "Participant" : "Non-participant"}</p>
                              {viewingExhibitor.detailedInfo.tombolaLotDescription && (
                                <p className="text-xs italic">Lot : {viewingExhibitor.detailedInfo.tombolaLotDescription}</p>
                              )}
                            </div>
                          </div>
                        </div>

                        <div className="space-y-2">
                          <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Commentaires Additionnels</p>
                          <div className="p-3 bg-secondary/5 border border-secondary/10 rounded-lg">
                            <p className="text-xs leading-relaxed italic">
                              {viewingExhibitor.detailedInfo.additionalComments || "Aucun commentaire particulier."}
                            </p>
                          </div>
                        </div>

                        <div className="space-y-2 pt-2 border-t">
                          <div className="flex flex-col gap-1">
                            <div className="flex items-center gap-2 text-[10px] font-bold">
                              {viewingExhibitor.detailedInfo.agreedToImageRights ? <CheckCircle className="w-3 h-3 text-green-600" /> : <XCircle className="w-3 h-3 text-destructive" />}
                              DROIT À L'IMAGE {viewingExhibitor.detailedInfo.agreedToImageRights ? "ACCEPTE" : "REFUSE"}
                            </div>
                            <div className="flex items-center gap-2 text-[10px] font-bold">
                              {viewingExhibitor.detailedInfo.agreedToTerms ? <CheckCircle className="w-3 h-3 text-green-600" /> : <XCircle className="w-3 h-3 text-destructive" />}
                              RÈGLEMENT MARCHÉ ACCEPTE
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                    
                    <div className="pt-4 border-t flex justify-between items-center bg-primary/5 p-4 rounded-xl">
                      <p className="text-sm font-bold text-primary">Nombre de tables demandées :</p>
                      <Badge className="text-lg px-4 py-1">{viewingExhibitor.requestedTables} table(s)</Badge>
                    </div>
                  </section>
                ) : (
                  <div className="p-12 text-center border-2 border-dashed rounded-2xl bg-muted/20">
                    <Clock className="w-12 h-12 text-muted-foreground mx-auto mb-4 animate-pulse" />
                    <p className="text-sm font-medium text-muted-foreground">Dossier technique non encore complété par l'exposant.</p>
                  </div>
                )}
              </div>
            )}
          </ScrollArea>
        </DialogContent>
      </Dialog>

      {/* Acceptance Dialog */}
      <Dialog open={isAcceptDialogOpen} onOpenChange={setIsAcceptDialogOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Accepter {actingExhibitor?.companyName}</DialogTitle></DialogHeader>
          <div className="py-4 space-y-4">
            <p className="text-xs text-muted-foreground">L'exposant recevra un email contenant son lien de finalisation technique.</p>
            <Textarea 
              placeholder="Ajouter un mot personnel (optionnel)..." 
              value={acceptanceMessage} 
              onChange={(e) => setAcceptanceMessage(e.target.value)} 
              rows={4} 
            />
          </div>
          <DialogFooter>
            <Button onClick={async () => {
              if (!actingExhibitor) return;
              setIsSending(true);
              updateDocumentNonBlocking(doc(db, 'pre_registrations', actingExhibitor.id), { status: 'accepted_form1' });
              const r = await sendAcceptanceEmail(actingExhibitor, acceptanceMessage, currentConfig);
              toast({ title: r.success ? "Candidature Acceptée" : "Erreur Email", variant: r.success ? "default" : "destructive" });
              setIsAcceptDialogOpen(false);
              setIsSending(false);
              setAcceptanceMessage('');
            }} disabled={isSending}>
              {isSending ? <Loader2 className="animate-spin" /> : "Confirmer et envoyer"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Rejection Dialog */}
      <Dialog open={isRejectDialogOpen} onOpenChange={setIsRejectDialogOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Refuser la candidature</DialogTitle></DialogHeader>
          <div className="py-4 space-y-4">
            <div className="flex flex-wrap gap-2">
              <Button variant="outline" size="sm" onClick={async () => {
                if (!actingExhibitor) return;
                setIsGenerating(true);
                const r = await generateRejectionJustification({ 
                  applicantName: `${actingExhibitor.firstName} ${actingExhibitor.lastName}`, 
                  applicationSummary: actingExhibitor.productDescription, 
                  rejectionReasons: ["Manque de place pour cette édition"] 
                });
                setJustification(r.justificationMessage);
                setIsGenerating(false);
              }} disabled={isGenerating}>
                {isGenerating ? <Loader2 className="animate-spin" /> : <Sparkles className="w-3 h-3 mr-2" />} IA: Place
              </Button>
              <Button variant="outline" size="sm" onClick={async () => {
                if (!actingExhibitor) return;
                setIsGenerating(true);
                const r = await generateRejectionJustification({ 
                  applicantName: `${actingExhibitor.firstName} ${actingExhibitor.lastName}`, 
                  applicationSummary: actingExhibitor.productDescription, 
                  rejectionReasons: ["Catégorie de produits déjà trop représentée"] 
                });
                setJustification(r.justificationMessage);
                setIsGenerating(false);
              }} disabled={isGenerating}>
                {isGenerating ? <Loader2 className="animate-spin" /> : <Sparkles className="w-3 h-3 mr-2" />} IA: Catégorie
              </Button>
            </div>
            <Textarea value={justification} onChange={(e) => setJustification(e.target.value)} placeholder="Rédiger le motif du refus..." rows={6} />
          </div>
          <DialogFooter>
            <Button variant="destructive" onClick={async () => {
              if (!actingExhibitor) return;
              setIsSending(true);
              updateDocumentNonBlocking(doc(db, 'pre_registrations', actingExhibitor.id), { status: 'rejected', rejectionJustification: justification });
              const r = await sendRejectionEmail(actingExhibitor, justification, currentConfig);
              toast({ title: r.success ? "Candidature Refusée" : "Erreur Email", variant: r.success ? "default" : "destructive" });
              setIsRejectDialogOpen(false);
              setIsSending(false);
              setJustification('');
            }} disabled={isSending || !justification}>Confirmer le refus</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
