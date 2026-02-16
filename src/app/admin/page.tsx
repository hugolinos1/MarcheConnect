
"use client"
import React, { useEffect, useState } from 'react';
import { Exhibitor, ApplicationStatus } from '@/lib/types';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { ChristmasSnow } from '@/components/ChristmasSnow';
import { CheckCircle, XCircle, FileText, Search, UserCheck, Globe, MapPin, Ticket, Zap, Utensils, Heart, Mail, Loader2, Trash2, Eye, EyeOff, Settings, Save, LogIn, ShieldAlert, Calendar, Plus, Users, UserPlus, ShieldCheck, UserPlus2, Clock, Lock, Info, ExternalLink, Sparkles, Download, Camera, LayoutGrid, Fingerprint, Euro } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { generateRejectionJustification } from '@/ai/flows/generate-rejection-justification';
import { Textarea } from '@/components/ui/textarea';
import Link from 'next/link';
import Image from 'next/image';
import { sendAcceptanceEmail, sendRejectionEmail } from '@/app/actions/email-actions';
import { useToast } from '@/hooks/use-toast';
import { useFirestore, useMemoFirebase, useCollection, useUser, useAuth, useDoc } from '@/firebase';
import { collection, doc, query, where, orderBy, getDoc } from 'firebase/firestore';
import { updateDocumentNonBlocking, setDocumentNonBlocking, deleteDocumentNonBlocking } from '@/firebase/non-blocking-updates';
import { initiateEmailSignIn, initiateEmailSignUp } from '@/firebase/non-blocking-login';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';
import * as XLSX from 'xlsx';

export default function AdminDashboard() {
  const { toast } = useToast();
  const db = useFirestore();
  const auth = useAuth();
  const { user, isUserLoading } = useUser();
  
  const [searchTerm, setSearchTerm] = useState('');
  const [isAuthLoading, setIsAuthLoading] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [isSavingConfig, setIsSavingConfig] = useState(false);
  const [justification, setJustification] = useState('');
  const [acceptanceMessage, setAcceptanceMessage] = useState('');
  const [selectedConfigId, setSelectedConfigId] = useState<string>('');
  const [showPassword, setShowPassword] = useState(false);
  const [viewingExhibitor, setViewingExhibitor] = useState<Exhibitor | null>(null);
  
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isSignUp, setIsSignUp] = useState(false);
  const [authError, setAuthError] = useState('');

  const [newAdminEmail, setNewAdminEmail] = useState('');
  const [newAdminUid, setNewAdminUid] = useState('');
  const [isAddingAdmin, setIsAddingAdmin] = useState(false);

  const logoUrl = "https://i.ibb.co/yncRPkvR/logo-ujpf.jpg";

  const userRoleRef = useMemoFirebase(() => {
    if (!user || !user.uid) return null;
    return doc(db, 'roles_admin', user.uid);
  }, [db, user]);
  const { data: userRoleDoc, isLoading: isRoleLoading } = useDoc(userRoleRef);

  const isSuperAdmin = user?.email === "hugues.rabier@gmail.com";
  const isAuthorized = isSuperAdmin || !!userRoleDoc;

  const marketConfigsQuery = useMemoFirebase(() => query(collection(db, 'market_configurations'), orderBy('marketYear', 'desc')), [db]);
  const { data: configs, isLoading: isConfigsLoading } = useCollection(marketConfigsQuery);
  
  const currentConfig = configs?.find(c => c.id === selectedConfigId) || configs?.find(c => c.currentMarket) || configs?.[0];

  useEffect(() => {
    if (currentConfig && !selectedConfigId) {
      setSelectedConfigId(currentConfig.id);
    }
  }, [currentConfig, selectedConfigId]);

  const adminsQuery = useMemoFirebase(() => {
    if (!isAuthorized) return null;
    return query(collection(db, 'roles_admin'));
  }, [db, isAuthorized]);
  const { data: adminUsers, isLoading: isAdminsLoading } = useCollection(adminsQuery);

  const exhibitorsQuery = useMemoFirebase(() => {
    if (!isAuthorized || !selectedConfigId) return null;
    return query(
      collection(db, 'pre_registrations'), 
      where('marketConfigurationId', '==', selectedConfigId)
    );
  }, [db, isAuthorized, selectedConfigId]);
  
  const { data: exhibitorsData, isLoading: isExhibitorsLoading } = useCollection<Exhibitor>(exhibitorsQuery);

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

    const authPromise = isSignUp 
      ? initiateEmailSignUp(auth, email, password)
      : initiateEmailSignIn(auth, email, password);

    authPromise
      .catch((err: any) => {
        if (err.code === 'auth/invalid-credential') setAuthError("Email ou mot de passe incorrect.");
        else setAuthError("Une erreur est survenue.");
      })
      .finally(() => setIsAuthLoading(false));
  };

  const handleAddAdmin = () => {
    if (!newAdminEmail || !newAdminUid) return;
    setIsAddingAdmin(true);
    const adminRef = doc(db, 'roles_admin', newAdminUid);
    setDocumentNonBlocking(adminRef, { email: newAdminEmail, uid: newAdminUid, addedAt: new Date().toISOString() }, { merge: true });
    setNewAdminEmail('');
    setNewAdminUid('');
    setIsAddingAdmin(false);
    toast({ title: "Accès ajouté" });
  };

  const handleRemoveAdmin = (uid: string) => {
    deleteDocumentNonBlocking(doc(db, 'roles_admin', uid));
    toast({ title: "Accès retiré" });
  };

  const handleSaveConfig = () => {
    setIsSavingConfig(true);
    const configId = selectedConfigId || `config-${configForm.marketYear}`;
    setDocumentNonBlocking(doc(db, 'market_configurations', configId), { ...configForm, id: configId, currentMarket: true }, { merge: true });
    toast({ title: "Paramètres enregistrés" });
    setIsSavingConfig(false);
  };

  const updateStatus = (id: string, status: ApplicationStatus, additionalData = {}) => {
    updateDocumentNonBlocking(doc(db, 'pre_registrations', id), { status, ...additionalData });
  };

  const handleAcceptAndSend = async (exhibitor: Exhibitor) => {
    setIsSending(true);
    const result = await sendAcceptanceEmail(exhibitor, acceptanceMessage, currentConfig);
    if (result.success) {
      updateStatus(exhibitor.id, 'accepted_form1');
      toast({ title: "Candidature acceptée et email envoyé" });
    }
    setIsSending(false);
    setAcceptanceMessage('');
  };

  const handleConfirmReject = async (exhibitor: Exhibitor) => {
    if (!justification) return;
    setIsSending(true);
    const result = await sendRejectionEmail(exhibitor, justification, currentConfig);
    if (result.success) {
      updateStatus(exhibitor.id, 'rejected', { rejectionJustification: justification });
      toast({ title: "Refus envoyé" });
    }
    setIsSending(false);
    setJustification('');
  };

  const handleGenerateRejectIA = async (exhibitor: Exhibitor, reasons: string[]) => {
    setIsGenerating(true);
    const result = await generateRejectionJustification({
      applicantName: `${exhibitor.firstName} ${exhibitor.lastName}`,
      applicationSummary: exhibitor.productDescription,
      rejectionReasons: reasons,
    });
    setJustification(result.justificationMessage);
    setIsGenerating(false);
  };

  const handleExportExcel = () => {
    if (!exhibitorsData || exhibitorsData.length === 0) {
      toast({ title: "Aucune donnée à exporter", variant: "destructive" });
      return;
    }

    const exportData = filteredExhibitors.map(e => ({
      "Enseigne": e.companyName,
      "Nom": e.lastName,
      "Prénom": e.firstName,
      "Email": e.email,
      "Téléphone": e.phone,
      "Tables": e.requestedTables,
      "Statut": e.status,
      "Adresse": e.address,
      "Ville": e.city,
      "Code Postal": e.postalCode,
      "Déclaré": e.isRegistered ? "Oui" : "Non",
      "SIRET": e.detailedInfo?.siret || "",
      "Site Web": e.websiteUrl || "",
      "Description": e.productDescription,
      "Electricité": e.detailedInfo?.needsElectricity ? "Oui" : "Non",
      "Grille": e.detailedInfo?.needsGrid ? "Oui" : "Non",
      "Repas Dimanche": e.detailedInfo?.sundayLunchCount || 0,
      "Assurance": e.detailedInfo?.insuranceCompany || "",
      "N° Police": e.detailedInfo?.insurancePolicyNumber || "",
      "Lot Tombola": e.detailedInfo?.tombolaLot ? "Oui" : "Non",
      "Description Lot": e.detailedInfo?.tombolaLotDescription || ""
    }));

    const worksheet = XLSX.utils.json_to_sheet(exportData);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Exposants");
    
    const fileName = `Exposants_Marche_${currentConfig?.marketYear || 'Export'}.xlsx`;
    XLSX.writeFile(workbook, fileName);
    
    toast({ title: "Exportation réussie" });
  };

  const filteredExhibitors = (exhibitorsData || []).filter(e => 
    e.companyName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    `${e.firstName} ${e.lastName}`.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const stats = {
    pending: (exhibitorsData || []).filter(e => e.status === 'pending').length,
    accepted: (exhibitorsData || []).filter(e => e.status === 'accepted_form1').length,
    validated: (exhibitorsData || []).filter(e => ['submitted_form2', 'validated'].includes(e.status)).length,
  };

  if (isUserLoading || isRoleLoading) return <div className="min-h-screen flex items-center justify-center"><Loader2 className="animate-spin" /></div>;

  if (!user || !user.email) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <ChristmasSnow />
        <Card className="max-w-md w-full border-t-8 border-t-primary shadow-2xl z-10">
          <CardHeader className="text-center">
            <CardTitle className="text-2xl font-bold text-primary">Accès Administration</CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleAuth} className="space-y-4">
              <Input type="email" placeholder="Email" value={email} onChange={(e) => setEmail(e.target.value)} required />
              <div className="relative">
                <Input type={showPassword ? "text" : "password"} placeholder="Mot de passe" value={password} onChange={(e) => setPassword(e.target.value)} required />
                <button type="button" className="absolute right-3 top-1/2 -translate-y-1/2" onClick={() => setShowPassword(!showPassword)}>
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
              <Button type="submit" disabled={isAuthLoading} className="w-full">
                {isAuthLoading ? <Loader2 className="animate-spin" /> : isSignUp ? "S'enregistrer" : "Se connecter"}
              </Button>
              <Button type="button" variant="ghost" className="w-full text-xs" onClick={() => setIsSignUp(!isSignUp)}>
                {isSignUp ? "Déjà un compte ? Se connecter" : "Nouveau ? S'enregistrer"}
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!isAuthorized) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <Card className="max-w-md w-full text-center p-6 space-y-4">
          <Clock className="w-12 h-12 mx-auto text-amber-500" />
          <h2 className="text-xl font-bold">Accès en attente</h2>
          <p className="text-sm text-muted-foreground">Votre UID : <code className="bg-muted p-1 rounded">{user.uid}</code></p>
          <Button onClick={() => auth.signOut()} variant="outline">Déconnexion</Button>
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
            <Image src={logoUrl} alt="Logo" width={40} height={40} className="rounded-full" />
            <h1 className="text-lg font-bold hidden md:block">Admin : Le Marché de Félix</h1>
          </div>
          <div className="flex gap-2">
            <Button asChild variant="secondary" size="sm" className="font-bold">
              <Link href="/">Voir le site</Link>
            </Button>
            <Button 
              onClick={() => auth.signOut()} 
              variant="ghost" 
              size="sm" 
              className="text-white border border-white/50 hover:bg-white hover:text-primary transition-colors font-bold"
            >
              Déconnexion
            </Button>
          </div>
        </div>
      </div>

      <main className="container mx-auto px-4 py-8 space-y-8">
        <Tabs defaultValue="exhibitors">
          <TabsList className="mb-6">
            <TabsTrigger value="exhibitors">Candidatures</TabsTrigger>
            <TabsTrigger value="settings">Paramètres Marché</TabsTrigger>
            <TabsTrigger value="access">Gestion Accès</TabsTrigger>
          </TabsList>

          <TabsContent value="exhibitors" className="space-y-6">
            <div className="grid md:grid-cols-4 gap-4">
              <Card className="col-span-1">
                <CardHeader className="p-4 pb-2"><CardTitle className="text-sm">Édition</CardTitle></CardHeader>
                <CardContent className="p-4 pt-0">
                  <span className="text-sm font-medium">Marché {currentConfig?.marketYear}</span>
                </CardContent>
              </Card>
              <Card><CardHeader className="p-4 pb-0"><CardTitle className="text-xs text-muted-foreground uppercase">À Étudier</CardTitle></CardHeader><CardContent className="p-4 text-2xl font-bold text-primary">{stats.pending}</CardContent></Card>
              <Card><CardHeader className="p-4 pb-0"><CardTitle className="text-xs text-muted-foreground uppercase">En cours</CardTitle></CardHeader><CardContent className="p-4 text-2xl font-bold text-secondary">{stats.accepted}</CardContent></Card>
              <Card><CardHeader className="p-4 pb-0"><CardTitle className="text-xs text-muted-foreground uppercase">Validés</CardTitle></CardHeader><CardContent className="p-4 text-2xl font-bold text-accent">{stats.validated}</CardContent></Card>
            </div>

            <div className="flex flex-col md:flex-row gap-4 items-center">
              <div className="relative flex-1 w-full">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input placeholder="Rechercher un exposant..." className="pl-10" value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} />
              </div>
              <Button onClick={handleExportExcel} variant="outline" className="gap-2 w-full md:w-auto border-primary/20 bg-white shadow-sm font-bold text-primary">
                <Download className="w-4 h-4" /> Exporter Excel
              </Button>
            </div>

            <Card className="overflow-hidden border-2 shadow-sm">
              <Table>
                <TableHeader className="bg-muted/30">
                  <TableRow>
                    <TableHead className="font-bold">Exposant</TableHead>
                    <TableHead className="font-bold">Tables</TableHead>
                    <TableHead className="font-bold">Statut</TableHead>
                    <TableHead className="text-right font-bold">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {isExhibitorsLoading ? <TableRow><TableCell colSpan={4} className="text-center py-8"><Loader2 className="animate-spin mx-auto" /></TableCell></TableRow> :
                    filteredExhibitors.map(exhibitor => (
                      <TableRow key={exhibitor.id} className="hover:bg-muted/10 transition-colors">
                        <TableCell>
                          <div className="font-bold text-primary">{exhibitor.companyName}</div>
                          <div className="text-xs text-muted-foreground font-medium">{exhibitor.firstName} {exhibitor.lastName}</div>
                        </TableCell>
                        <TableCell><Badge variant="outline" className="border-primary/20">{exhibitor.requestedTables}</Badge></TableCell>
                        <TableCell>
                          <Badge variant={exhibitor.status === 'pending' ? 'secondary' : exhibitor.status === 'rejected' ? 'destructive' : 'default'} className="shadow-none">
                            {exhibitor.status === 'pending' ? 'À étudier' : exhibitor.status === 'accepted_form1' ? 'Accepté (F1)' : exhibitor.status === 'submitted_form2' ? 'Dossier reçu' : exhibitor.status === 'validated' ? 'Validé' : 'Refusé'}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex justify-end gap-2">
                            <Button 
                              variant="outline" 
                              size="sm" 
                              onClick={() => setViewingExhibitor(exhibitor)} 
                              title="Voir détails" 
                              className="bg-white border-primary/30 text-primary hover:bg-primary/5 transition-all shadow-sm"
                            >
                              <Eye className="w-5 h-5" />
                            </Button>
                            
                            {exhibitor.status === 'pending' && (
                              <>
                                <Dialog>
                                  <DialogTrigger asChild>
                                    <Button size="sm" className="bg-green-600 hover:bg-green-700 shadow-sm">
                                      <CheckCircle className="w-4 h-4" />
                                    </Button>
                                  </DialogTrigger>
                                  <DialogContent>
                                    <DialogHeader><DialogTitle>Accepter la candidature</DialogTitle></DialogHeader>
                                    <Textarea placeholder="Message personnalisé (optionnel)..." value={acceptanceMessage} onChange={(e) => setAcceptanceMessage(e.target.value)} />
                                    <DialogFooter><Button onClick={() => handleAcceptAndSend(exhibitor)} disabled={isSending}>Confirmer et Envoyer l'email</Button></DialogFooter>
                                  </DialogContent>
                                </Dialog>
                                
                                <Dialog>
                                  <DialogTrigger asChild>
                                    <Button variant="destructive" size="sm" className="shadow-sm">
                                      <XCircle className="w-4 h-4" />
                                    </Button>
                                  </DialogTrigger>
                                  <DialogContent>
                                    <DialogHeader><DialogTitle>Refuser la candidature</DialogTitle></DialogHeader>
                                    <div className="space-y-4">
                                      <div className="flex gap-2">
                                        <Button variant="outline" onClick={() => handleGenerateRejectIA(exhibitor, ["Manque de place"])} disabled={isGenerating}>IA: Manque de place</Button>
                                        <Button variant="outline" onClick={() => handleGenerateRejectIA(exhibitor, ["Produits non artisanaux"])} disabled={isGenerating}>IA: Non artisanal</Button>
                                      </div>
                                      <Textarea value={justification} onChange={(e) => setJustification(e.target.value)} placeholder="Motif du refus..." rows={6} />
                                    </div>
                                    <DialogFooter><Button variant="destructive" onClick={() => handleConfirmReject(exhibitor)} disabled={isSending}>Envoyer le refus</Button></DialogFooter>
                                  </DialogContent>
                                </Dialog>
                              </>
                            )}

                            {exhibitor.status === 'submitted_form2' && (
                              <Button 
                                size="sm" 
                                className="bg-blue-600 hover:bg-blue-700 shadow-sm"
                                onClick={() => updateStatus(exhibitor.id, 'validated')}
                                title="Valider définitivement (Règlement reçu)"
                              >
                                <ShieldCheck className="w-4 h-4" />
                              </Button>
                            )}

                            <Button asChild variant="outline" size="sm" title="Voir page dossier" className="bg-white border-muted-foreground/30 hover:bg-muted transition-all shadow-sm">
                              <Link href={`/details/${exhibitor.id}`} target="_blank"><ExternalLink className="w-4 h-4" /></Link>
                            </Button>
                            
                            <AlertDialog>
                              <AlertDialogTrigger asChild>
                                <Button variant="outline" size="sm" className="bg-white border-destructive/30 text-destructive hover:bg-destructive/5 transition-all shadow-sm">
                                  <Trash2 className="w-4 h-4" />
                                </Button>
                              </AlertDialogTrigger>
                              <AlertDialogContent>
                                <AlertDialogHeader><AlertDialogTitle>Supprimer ?</AlertDialogTitle></AlertDialogHeader>
                                <AlertDialogFooter><AlertDialogCancel>Annuler</AlertDialogCancel><AlertDialogAction onClick={() => deleteDocumentNonBlocking(doc(db, 'pre_registrations', exhibitor.id))}>Supprimer</AlertDialogAction></AlertDialogFooter>
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

          <TabsContent value="settings">
            <Card className="max-w-2xl mx-auto shadow-md border-t-4 border-t-primary">
              <CardHeader><CardTitle className="text-primary">Configuration du Marché</CardTitle></CardHeader>
              <CardContent className="space-y-6">
                <div className="space-y-4">
                   <h3 className="text-sm font-bold border-b pb-1 uppercase tracking-wider text-muted-foreground flex items-center gap-2">
                     <Settings className="w-4 h-4" /> Général
                   </h3>
                   <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2"><label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Année</label><Input type="number" className="border-primary/20 focus:border-primary" value={configForm.marketYear} onChange={(e) => setConfigForm({...configForm, marketYear: parseInt(e.target.value)})} /></div>
                    <div className="space-y-2"><label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Édition</label><Input className="border-primary/20 focus:border-primary" value={configForm.editionNumber} onChange={(e) => setConfigForm({...configForm, editionNumber: e.target.value})} /></div>
                  </div>
                  <div className="space-y-2"><label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">URL de l'Affiche</label><Input className="border-primary/20 focus:border-primary" value={configForm.posterImageUrl} onChange={(e) => setConfigForm({...configForm, posterImageUrl: e.target.value})} /></div>
                  <div className="space-y-2"><label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Email de notification (Réception & Copie)</label><Input type="email" className="border-primary/20 focus:border-primary" value={configForm.notificationEmail} onChange={(e) => setConfigForm({...configForm, notificationEmail: e.target.value})} /></div>
                </div>

                <div className="space-y-4">
                  <h3 className="text-sm font-bold border-b pb-1 uppercase tracking-wider text-muted-foreground flex items-center gap-2">
                    <Euro className="w-4 h-4" /> Tarification (€)
                  </h3>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Prix 1 Table (1.75m)</label>
                      <Input type="number" className="border-primary/20 focus:border-primary" value={configForm.priceTable1} onChange={(e) => setConfigForm({...configForm, priceTable1: parseFloat(e.target.value)})} />
                    </div>
                    <div className="space-y-2">
                      <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Prix 2 Tables (3.50m)</label>
                      <Input type="number" className="border-primary/20 focus:border-primary" value={configForm.priceTable2} onChange={(e) => setConfigForm({...configForm, priceTable2: parseFloat(e.target.value)})} />
                    </div>
                    <div className="space-y-2">
                      <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Prix Repas Dimanche</label>
                      <Input type="number" className="border-primary/20 focus:border-primary" value={configForm.priceMeal} onChange={(e) => setConfigForm({...configForm, priceMeal: parseFloat(e.target.value)})} />
                    </div>
                    <div className="space-y-2">
                      <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Prix Option Électricité</label>
                      <Input type="number" className="border-primary/20 focus:border-primary" value={configForm.priceElectricity} onChange={(e) => setConfigForm({...configForm, priceElectricity: parseFloat(e.target.value)})} />
                    </div>
                  </div>
                </div>

                <Button onClick={handleSaveConfig} className="w-full font-bold shadow-sm mt-4">Enregistrer les paramètres</Button>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="access">
             <div className="grid md:grid-cols-2 gap-8">
               <Card className="shadow-md border-t-4 border-t-primary">
                 <CardHeader><CardTitle className="text-primary">Ajouter un Administrateur</CardTitle></CardHeader>
                 <CardContent className="space-y-4">
                   <Input placeholder="Email" className="border-primary/20" value={newAdminEmail} onChange={(e) => setNewAdminEmail(e.target.value)} />
                   <Input placeholder="UID Firebase" className="border-primary/20" value={newAdminUid} onChange={(e) => setNewAdminUid(e.target.value)} />
                   <Button onClick={handleAddAdmin} className="w-full font-bold">Autoriser l'accès</Button>
                 </CardContent>
               </Card>
               <Card className="shadow-md border-t-4 border-t-primary">
                 <CardHeader><CardTitle className="text-primary">Liste des Admins</CardTitle></CardHeader>
                 <CardContent>
                    <Table>
                      <TableBody>
                        {adminUsers?.map(admin => (
                          <TableRow key={admin.uid}>
                            <TableCell className="font-medium">{admin.email}</TableCell>
                            <TableCell className="text-right">
                              {admin.email !== "hugues.rabier@gmail.com" && (
                                <Button variant="outline" onClick={() => handleRemoveAdmin(admin.uid)} className="border-destructive/30 text-destructive hover:bg-destructive/10">
                                  <Trash2 className="w-4 h-4" />
                                </Button>
                              )}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                 </CardContent>
               </Card>
             </div>
          </TabsContent>
        </Tabs>
      </main>

      {/* Modal Détails Candidat */}
      <Dialog open={!!viewingExhibitor} onOpenChange={(open) => !open && setViewingExhibitor(null)}>
        <DialogContent className="max-w-2xl max-h-[90vh]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-primary">
              <FileText className="w-6 h-6" /> Détails de la candidature
            </DialogTitle>
          </DialogHeader>
          <ScrollArea className="pr-4 h-[70vh]">
            {viewingExhibitor && (
              <div className="space-y-6 py-4">
                <section className="grid grid-cols-2 gap-4 bg-muted/30 p-4 rounded-lg border">
                  <div><p className="text-[10px] font-bold uppercase text-muted-foreground">Enseigne</p><p className="font-bold text-primary">{viewingExhibitor.companyName}</p></div>
                  <div><p className="text-[10px] font-bold uppercase text-muted-foreground">Contact</p><p>{viewingExhibitor.firstName} {viewingExhibitor.lastName}</p></div>
                  <div><p className="text-[10px] font-bold uppercase text-muted-foreground">Email</p><p className="text-sm">{viewingExhibitor.email}</p></div>
                  <div><p className="text-[10px] font-bold uppercase text-muted-foreground">Téléphone</p><p className="text-sm">{viewingExhibitor.phone}</p></div>
                  <div className="col-span-2"><p className="text-[10px] font-bold uppercase text-muted-foreground">Adresse</p><p className="text-sm">{viewingExhibitor.address}, {viewingExhibitor.postalCode} {viewingExhibitor.city}</p></div>
                </section>

                {/* Displaying Administratif (Form 2) */}
                {viewingExhibitor.detailedInfo && (
                  <section className="space-y-2">
                    <h4 className="text-sm font-bold border-b pb-1 text-primary flex items-center gap-2">
                      <Fingerprint className="w-4 h-4" /> Administratif (Form. 2)
                    </h4>
                    <div className="grid grid-cols-2 gap-4 bg-primary/5 p-4 rounded-lg border">
                      {viewingExhibitor.isRegistered && (
                        <div className="col-span-2"><p className="text-[10px] font-bold uppercase text-muted-foreground">SIRET</p><p className="font-bold">{viewingExhibitor.detailedInfo.siret || "Non renseigné"}</p></div>
                      )}
                      {viewingExhibitor.detailedInfo.idCardPhoto && (
                        <div className="col-span-2 space-y-2">
                          <p className="text-[10px] font-bold uppercase text-muted-foreground">Pièce d'identité</p>
                          <div className="relative aspect-video w-full rounded-md overflow-hidden border">
                            <Image src={viewingExhibitor.detailedInfo.idCardPhoto} alt="ID Card" fill className="object-contain bg-white" />
                          </div>
                        </div>
                      )}
                    </div>
                  </section>
                )}

                {/* Displaying Product Images */}
                {viewingExhibitor.productImages && viewingExhibitor.productImages.length > 0 && (
                  <section className="space-y-2">
                    <h4 className="text-sm font-bold border-b pb-1 text-primary flex items-center gap-2">
                      <Camera className="w-4 h-4" /> Photos des produits
                    </h4>
                    <div className="grid grid-cols-3 gap-2">
                      {viewingExhibitor.productImages.map((img, idx) => (
                        <div key={idx} className="relative aspect-square rounded-md overflow-hidden border shadow-inner">
                          <Image src={img} alt={`Produit ${idx + 1}`} fill className="object-cover" />
                        </div>
                      ))}
                    </div>
                  </section>
                )}

                <section className="space-y-2">
                  <h4 className="text-sm font-bold border-b pb-1 text-primary">Détails du Stand</h4>
                  <div className="grid grid-cols-2 gap-4">
                    <div><p className="text-[10px] font-bold uppercase text-muted-foreground">Tables demandées</p><p className="font-medium">{viewingExhibitor.requestedTables} table(s)</p></div>
                    <div><p className="text-[10px] font-bold uppercase text-muted-foreground">Statut Pro</p><p className="font-medium">{viewingExhibitor.isRegistered ? "Déclaré" : "Particulier"}</p></div>
                    <div className="col-span-2">
                      <p className="text-[10px] font-bold uppercase text-muted-foreground">Description produits</p>
                      <p className="text-sm whitespace-pre-wrap bg-white p-3 rounded border italic shadow-inner">{viewingExhibitor.productDescription}</p>
                    </div>
                    {viewingExhibitor.websiteUrl && (
                      <div className="col-span-2">
                        <p className="text-[10px] font-bold uppercase text-muted-foreground">Site / Réseaux</p>
                        <a href={viewingExhibitor.websiteUrl} target="_blank" className="text-sm text-primary hover:underline flex items-center gap-1 font-medium">
                          {viewingExhibitor.websiteUrl} <ExternalLink className="w-3 h-3" />
                        </a>
                      </div>
                    )}
                  </div>
                </section>

                {viewingExhibitor.detailedInfo && (
                  <section className="space-y-2">
                    <h4 className="text-sm font-bold border-b pb-1 text-secondary">Détails Techniques (Form. 2)</h4>
                    <div className="grid grid-cols-2 gap-4 bg-secondary/5 p-4 rounded-lg border border-secondary/20">
                      <div><p className="text-[10px] font-bold uppercase text-muted-foreground">Électricité</p><p className="font-medium">{viewingExhibitor.detailedInfo.needsElectricity ? "Oui" : "Non"}</p></div>
                      <div><p className="text-[10px] font-bold uppercase text-muted-foreground">Grille</p><p className="font-medium">{viewingExhibitor.detailedInfo.needsGrid ? "Oui" : "Non"}</p></div>
                      <div><p className="text-[10px] font-bold uppercase text-muted-foreground">Repas Dimanche</p><p className="font-medium">{viewingExhibitor.detailedInfo.sundayLunchCount} plateaux</p></div>
                      <div><p className="text-[10px] font-bold uppercase text-muted-foreground">Lot Tombola</p><p className="font-medium">{viewingExhibitor.detailedInfo.tombolaLot ? "Oui" : "Non"}</p></div>
                      <div className="col-span-2"><p className="text-[10px] font-bold uppercase text-muted-foreground">Assurance</p><p className="text-xs font-medium">{viewingExhibitor.detailedInfo.insuranceCompany} (N° {viewingExhibitor.detailedInfo.insurancePolicyNumber})</p></div>
                    </div>
                  </section>
                )}
                
                {viewingExhibitor.rejectionJustification && (
                  <section className="p-4 bg-destructive/5 rounded-lg border border-destructive/20">
                    <p className="text-[10px] font-bold uppercase text-destructive">Motif du refus envoyé</p>
                    <p className="text-sm italic">{viewingExhibitor.rejectionJustification}</p>
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
