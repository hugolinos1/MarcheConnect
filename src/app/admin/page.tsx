
"use client"
import React, { useEffect, useState } from 'react';
import { Exhibitor, ApplicationStatus } from '@/lib/types';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { ChristmasSnow } from '@/components/ChristmasSnow';
import { CheckCircle, XCircle, FileText, Search, UserCheck, Globe, MapPin, Ticket, Zap, Utensils, Heart, Mail, Loader2, Trash2, Eye, EyeOff, Settings, Save, LogIn, ShieldAlert, Calendar, Plus, Users, UserPlus, ShieldCheck, UserPlus2, Clock, Lock, Info, ExternalLink, Sparkles } from 'lucide-react';
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
  
  // Login/Signup states
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isSignUp, setIsSignUp] = useState(false);
  const [authError, setAuthError] = useState('');

  // Admin Access management states
  const [newAdminEmail, setNewAdminEmail] = useState('');
  const [newAdminUid, setNewAdminUid] = useState('');
  const [isAddingAdmin, setIsAddingAdmin] = useState(false);

  const logoUrl = "https://i.ibb.co/yncRPkvR/logo-ujpf.jpg";

  // Check if current user has admin document
  const userRoleRef = useMemoFirebase(() => {
    if (!user || !user.uid) return null;
    return doc(db, 'roles_admin', user.uid);
  }, [db, user]);
  const { data: userRoleDoc, isLoading: isRoleLoading } = useDoc(userRoleRef);

  const isSuperAdmin = user?.email === "hugues.rabier@gmail.com";
  const isAuthorized = isSuperAdmin || !!userRoleDoc;

  // Market Configs fetching
  const marketConfigsQuery = useMemoFirebase(() => query(collection(db, 'market_configurations'), orderBy('marketYear', 'desc')), [db]);
  const { data: configs, isLoading: isConfigsLoading } = useCollection(marketConfigsQuery);
  
  const currentConfig = configs?.find(c => c.id === selectedConfigId) || configs?.find(c => c.currentMarket) || configs?.[0];

  useEffect(() => {
    if (currentConfig && !selectedConfigId) {
      setSelectedConfigId(currentConfig.id);
    }
  }, [currentConfig, selectedConfigId]);

  // Admins fetching
  const adminsQuery = useMemoFirebase(() => {
    if (!isAuthorized) return null;
    return query(collection(db, 'roles_admin'));
  }, [db, isAuthorized]);
  const { data: adminUsers, isLoading: isAdminsLoading } = useCollection(adminsQuery);

  // Exhibitors fetching
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
    posterImageUrl: "https://i.ibb.co/3y3KRNW4/Affiche-March.jpg"
  });

  useEffect(() => {
    if (currentConfig) {
      setConfigForm({
        marketYear: currentConfig.marketYear,
        editionNumber: currentConfig.editionNumber,
        posterImageUrl: currentConfig.posterImageUrl
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

  const filteredExhibitors = (exhibitorsData || []).filter(e => 
    e.companyName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    `${e.firstName} ${e.lastName}`.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const stats = {
    pending: (exhibitorsData || []).filter(e => e.status === 'pending').length,
    accepted: (exhibitorsData || []).filter(e => ['accepted_form1', 'submitted_form2', 'validated'].includes(e.status)).length,
    validated: (exhibitorsData || []).filter(e => e.status === 'validated').length,
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
            <Button asChild variant="secondary" size="sm"><Link href="/">Voir le site</Link></Button>
            <Button onClick={() => auth.signOut()} variant="outline" size="sm">Déconnexion</Button>
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
                  <Select value={selectedConfigId} onValueChange={setSelectedConfigId}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {configs?.map(c => <SelectItem key={c.id} value={c.id}>Marché {c.marketYear}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </CardContent>
              </Card>
              <Card><CardHeader className="p-4 pb-0"><CardTitle className="text-xs text-muted-foreground uppercase">À Étudier</CardTitle></CardHeader><CardContent className="p-4 text-2xl font-bold text-primary">{stats.pending}</CardContent></Card>
              <Card><CardHeader className="p-4 pb-0"><CardTitle className="text-xs text-muted-foreground uppercase">En cours</CardTitle></CardHeader><CardContent className="p-4 text-2xl font-bold text-secondary">{stats.accepted}</CardContent></Card>
              <Card><CardHeader className="p-4 pb-0"><CardTitle className="text-xs text-muted-foreground uppercase">Validés</CardTitle></CardHeader><CardContent className="p-4 text-2xl font-bold text-accent">{stats.validated}</CardContent></Card>
            </div>

            <div className="flex gap-4">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input placeholder="Rechercher un exposant..." className="pl-10" value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} />
              </div>
            </div>

            <Card className="overflow-hidden">
              <Table>
                <TableHeader><TableRow><TableHead>Exposant</TableHead><TableHead>Tables</TableHead><TableHead>Statut</TableHead><TableHead className="text-right">Actions</TableHead></TableRow></TableHeader>
                <TableBody>
                  {isExhibitorsLoading ? <TableRow><TableCell colSpan={4} className="text-center py-8"><Loader2 className="animate-spin mx-auto" /></TableCell></TableRow> :
                    filteredExhibitors.map(exhibitor => (
                      <TableRow key={exhibitor.id}>
                        <TableCell>
                          <div className="font-bold">{exhibitor.companyName}</div>
                          <div className="text-xs text-muted-foreground">{exhibitor.firstName} {exhibitor.lastName}</div>
                        </TableCell>
                        <TableCell><Badge variant="outline">{exhibitor.requestedTables}</Badge></TableCell>
                        <TableCell>
                          <Badge variant={exhibitor.status === 'pending' ? 'secondary' : exhibitor.status === 'rejected' ? 'destructive' : 'default'}>
                            {exhibitor.status === 'pending' ? 'À étudier' : exhibitor.status === 'accepted_form1' ? 'Accepté (F1)' : exhibitor.status === 'submitted_form2' ? 'Dossier reçu' : exhibitor.status === 'validated' ? 'Validé' : 'Refusé'}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right space-x-2">
                          <Button variant="ghost" size="sm" onClick={() => setViewingExhibitor(exhibitor)} title="Voir détails">
                            <Info className="w-4 h-4" />
                          </Button>
                          
                          {exhibitor.status === 'pending' && (
                            <>
                              <Dialog>
                                <DialogTrigger asChild><Button size="sm" className="bg-green-600 hover:bg-green-700"><CheckCircle className="w-4 h-4" /></Button></DialogTrigger>
                                <DialogContent>
                                  <DialogHeader><DialogTitle>Accepter la candidature</DialogTitle></DialogHeader>
                                  <Textarea placeholder="Message personnalisé (optionnel)..." value={acceptanceMessage} onChange={(e) => setAcceptanceMessage(e.target.value)} />
                                  <DialogFooter><Button onClick={() => handleAcceptAndSend(exhibitor)} disabled={isSending}>Confirmer et Envoyer l'email</Button></DialogFooter>
                                </DialogContent>
                              </Dialog>
                              
                              <Dialog>
                                <DialogTrigger asChild><Button variant="destructive" size="sm"><XCircle className="w-4 h-4" /></Button></DialogTrigger>
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

                          <Button asChild variant="ghost" size="sm" title="Voir page dossier">
                            <Link href={`/details/${exhibitor.id}`} target="_blank"><ExternalLink className="w-4 h-4" /></Link>
                          </Button>
                          
                          <AlertDialog>
                            <AlertDialogTrigger asChild><Button variant="ghost" size="sm" className="text-destructive"><Trash2 className="w-4 h-4" /></Button></AlertDialogTrigger>
                            <AlertDialogContent>
                              <AlertDialogHeader><AlertDialogTitle>Supprimer ?</AlertDialogTitle></AlertDialogHeader>
                              <AlertDialogFooter><AlertDialogCancel>Annuler</AlertDialogCancel><AlertDialogAction onClick={() => deleteDocumentNonBlocking(doc(db, 'pre_registrations', exhibitor.id))}>Supprimer</AlertDialogAction></AlertDialogFooter>
                            </AlertDialogContent>
                          </AlertDialog>
                        </TableCell>
                      </TableRow>
                    ))}
                </TableBody>
              </Table>
            </Card>
          </TabsContent>

          <TabsContent value="settings">
            <Card className="max-w-2xl mx-auto">
              <CardHeader><CardTitle>Configuration du Marché</CardTitle></CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2"><label className="text-xs font-bold">Année</label><Input type="number" value={configForm.marketYear} onChange={(e) => setConfigForm({...configForm, marketYear: parseInt(e.target.value)})} /></div>
                  <div className="space-y-2"><label className="text-xs font-bold">Édition</label><Input value={configForm.editionNumber} onChange={(e) => setConfigForm({...configForm, editionNumber: e.target.value})} /></div>
                </div>
                <div className="space-y-2"><label className="text-xs font-bold">URL de l'Affiche</label><Input value={configForm.posterImageUrl} onChange={(e) => setConfigForm({...configForm, posterImageUrl: e.target.value})} /></div>
                <Button onClick={handleSaveConfig} className="w-full">Enregistrer</Button>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="access">
             <div className="grid md:grid-cols-2 gap-8">
               <Card>
                 <CardHeader><CardTitle>Ajouter un Administrateur</CardTitle></CardHeader>
                 <CardContent className="space-y-4">
                   <Input placeholder="Email" value={newAdminEmail} onChange={(e) => setNewAdminEmail(e.target.value)} />
                   <Input placeholder="UID Firebase" value={newAdminUid} onChange={(e) => setNewAdminUid(e.target.value)} />
                   <Button onClick={handleAddAdmin} className="w-full">Autoriser</Button>
                 </CardContent>
               </Card>
               <Card>
                 <CardHeader><CardTitle>Liste des Admins</CardTitle></CardHeader>
                 <CardContent>
                    <Table>
                      <TableBody>
                        {adminUsers?.map(admin => (
                          <TableRow key={admin.uid}>
                            <TableCell>{admin.email}</TableCell>
                            <TableCell className="text-right">
                              {admin.email !== "hugues.rabier@gmail.com" && <Button variant="ghost" onClick={() => handleRemoveAdmin(admin.uid)}><Trash2 className="w-4 h-4" /></Button>}
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
            <DialogTitle className="flex items-center gap-2">
              <FileText className="w-5 h-5 text-primary" /> Détails de la candidature
            </DialogTitle>
          </DialogHeader>
          <ScrollArea className="pr-4">
            {viewingExhibitor && (
              <div className="space-y-6 py-4">
                <section className="grid grid-cols-2 gap-4 bg-muted/30 p-4 rounded-lg">
                  <div><p className="text-[10px] font-bold uppercase text-muted-foreground">Enseigne</p><p className="font-bold">{viewingExhibitor.companyName}</p></div>
                  <div><p className="text-[10px] font-bold uppercase text-muted-foreground">Contact</p><p>{viewingExhibitor.firstName} {viewingExhibitor.lastName}</p></div>
                  <div><p className="text-[10px] font-bold uppercase text-muted-foreground">Email</p><p className="text-sm">{viewingExhibitor.email}</p></div>
                  <div><p className="text-[10px] font-bold uppercase text-muted-foreground">Téléphone</p><p className="text-sm">{viewingExhibitor.phone}</p></div>
                  <div className="col-span-2"><p className="text-[10px] font-bold uppercase text-muted-foreground">Adresse</p><p className="text-sm">{viewingExhibitor.address}, {viewingExhibitor.postalCode} {viewingExhibitor.city}</p></div>
                </section>

                <section className="space-y-2">
                  <h4 className="text-sm font-bold border-b pb-1">Détails du Stand</h4>
                  <div className="grid grid-cols-2 gap-4">
                    <div><p className="text-[10px] font-bold uppercase text-muted-foreground">Tables demandées</p><p>{viewingExhibitor.requestedTables} table(s)</p></div>
                    <div><p className="text-[10px] font-bold uppercase text-muted-foreground">Statut Pro</p><p>{viewingExhibitor.isRegistered ? "Déclaré" : "Particulier"}</p></div>
                    <div className="col-span-2">
                      <p className="text-[10px] font-bold uppercase text-muted-foreground">Description produits</p>
                      <p className="text-sm whitespace-pre-wrap bg-white p-3 rounded border italic">{viewingExhibitor.productDescription}</p>
                    </div>
                    {viewingExhibitor.websiteUrl && (
                      <div className="col-span-2">
                        <p className="text-[10px] font-bold uppercase text-muted-foreground">Site / Réseaux</p>
                        <a href={viewingExhibitor.websiteUrl} target="_blank" className="text-sm text-primary hover:underline flex items-center gap-1">
                          {viewingExhibitor.websiteUrl} <ExternalLink className="w-3 h-3" />
                        </a>
                      </div>
                    )}
                  </div>
                </section>

                {viewingExhibitor.detailedInfo && (
                  <section className="space-y-2">
                    <h4 className="text-sm font-bold border-b pb-1 text-secondary">Détails Techniques (Form. 2)</h4>
                    <div className="grid grid-cols-2 gap-4 bg-secondary/5 p-4 rounded-lg">
                      <div><p className="text-[10px] font-bold uppercase text-muted-foreground">Électricité</p><p>{viewingExhibitor.detailedInfo.needsElectricity ? "Oui" : "Non"}</p></div>
                      <div><p className="text-[10px] font-bold uppercase text-muted-foreground">Repas Dimanche</p><p>{viewingExhibitor.detailedInfo.sundayLunchCount} plateaux</p></div>
                      <div><p className="text-[10px] font-bold uppercase text-muted-foreground">Assurance</p><p className="text-xs">{viewingExhibitor.detailedInfo.insuranceCompany} (N° {viewingExhibitor.detailedInfo.insurancePolicyNumber})</p></div>
                      <div><p className="text-[10px] font-bold uppercase text-muted-foreground">Lot Tombola</p><p>{viewingExhibitor.detailedInfo.tombolaLot ? "Oui" : "Non"}</p></div>
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

