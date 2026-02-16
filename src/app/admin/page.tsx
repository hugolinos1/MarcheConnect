
"use client"
import React, { useEffect, useState } from 'react';
import { Exhibitor, ApplicationStatus } from '@/lib/types';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { ChristmasSnow } from '@/components/ChristmasSnow';
import { CheckCircle, XCircle, FileText, Search, UserCheck, Globe, MapPin, Ticket, Zap, Utensils, Heart, Mail, Loader2, Trash2, Eye, Settings, Save, LogIn, ShieldAlert, Calendar, Plus, Users, UserPlus, ShieldCheck } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { generateRejectionJustification } from '@/ai/flows/generate-rejection-justification';
import { Textarea } from '@/components/ui/textarea';
import Link from 'next/link';
import Image from 'next/image';
import { sendAcceptanceEmail, sendRejectionEmail } from '@/app/actions/email-actions';
import { useToast } from '@/hooks/use-toast';
import { useFirestore, useMemoFirebase, useCollection, useUser, useAuth } from '@/firebase';
import { collection, doc, query, where, orderBy, getDoc } from 'firebase/firestore';
import { updateDocumentNonBlocking, setDocumentNonBlocking, deleteDocumentNonBlocking } from '@/firebase/non-blocking-updates';
import { initiateEmailSignIn } from '@/firebase/non-blocking-login';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

export default function AdminDashboard() {
  const { toast } = useToast();
  const db = useFirestore();
  const auth = useAuth();
  const { user, isUserLoading } = useUser();
  
  const [searchTerm, setSearchTerm] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [isSavingConfig, setIsSavingConfig] = useState(false);
  const [justification, setJustification] = useState('');
  const [acceptanceMessage, setAcceptanceMessage] = useState('');
  const [selectedExhibitor, setSelectedExhibitor] = useState<Exhibitor | null>(null);
  const [selectedConfigId, setSelectedConfigId] = useState<string>('');
  
  // Login states
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loginError, setLoginError] = useState('');

  // Admin Access management states
  const [newAdminEmail, setNewAdminEmail] = useState('');
  const [newAdminUid, setNewAdminUid] = useState('');
  const [isAddingAdmin, setIsAddingAdmin] = useState(false);

  const logoUrl = "https://i.ibb.co/yncRPkvR/logo-ujpf.jpg";

  // Market Configs fetching
  const marketConfigsQuery = useMemoFirebase(() => query(collection(db, 'market_configurations'), orderBy('marketYear', 'desc')), [db]);
  const { data: configs, isLoading: isConfigsLoading } = useCollection(marketConfigsQuery);
  
  const currentConfig = configs?.find(c => c.id === selectedConfigId) || configs?.find(c => c.currentMarket) || configs?.[0];

  // Admins fetching
  const adminsQuery = useMemoFirebase(() => query(collection(db, 'roles_admin')), [db]);
  const { data: adminUsers, isLoading: isAdminsLoading } = useCollection(adminsQuery);

  useEffect(() => {
    if (currentConfig && !selectedConfigId) {
      setSelectedConfigId(currentConfig.id);
    }
  }, [currentConfig, selectedConfigId]);

  // Exhibitors fetching - filtered by selected market configuration
  const exhibitorsQuery = useMemoFirebase(() => {
    if (isUserLoading || !user || !selectedConfigId) return null;
    return query(
      collection(db, 'pre_registrations'), 
      where('marketConfigurationId', '==', selectedConfigId)
    );
  }, [db, user, isUserLoading, selectedConfigId]);
  
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

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    setLoginError('');
    try {
      initiateEmailSignIn(auth, email, password);
    } catch (err: any) {
      setLoginError("Erreur de connexion. Vérifiez vos identifiants.");
    }
  };

  const handleAddAdmin = () => {
    if (!newAdminEmail || !newAdminUid) {
      toast({ variant: "destructive", title: "Champs requis", description: "Veuillez saisir l'e-mail et l'UID." });
      return;
    }
    setIsAddingAdmin(true);
    const adminRef = doc(db, 'roles_admin', newAdminUid);
    setDocumentNonBlocking(adminRef, {
      email: newAdminEmail,
      uid: newAdminUid,
      addedAt: new Date().toISOString()
    }, { merge: true });

    setNewAdminEmail('');
    setNewAdminUid('');
    setIsAddingAdmin(false);
    toast({ title: "Accès ajouté", description: `${newAdminEmail} est désormais administrateur.` });
  };

  const handleRemoveAdmin = (uid: string) => {
    const adminRef = doc(db, 'roles_admin', uid);
    deleteDocumentNonBlocking(adminRef);
    toast({ title: "Accès retiré", description: "L'utilisateur n'est plus administrateur." });
  };

  const handleSaveConfig = () => {
    setIsSavingConfig(true);
    const configId = selectedConfigId || `config-${configForm.marketYear}`;
    const configRef = doc(db, 'market_configurations', configId);
    
    setDocumentNonBlocking(configRef, {
      ...configForm,
      id: configId,
      currentMarket: true
    }, { merge: true });

    toast({
      title: "Paramètres enregistrés",
      description: `L'édition ${configForm.marketYear} a été mise à jour.`,
    });
    setIsSavingConfig(false);
  };

  const handleCreateNewEdition = () => {
    const nextYear = (configs && configs.length > 0) ? Math.max(...configs.map(c => c.marketYear)) + 1 : new Date().getFullYear() + 1;
    const newId = `config-${nextYear}`;
    const newConfigRef = doc(db, 'market_configurations', newId);
    
    setDocumentNonBlocking(newConfigRef, {
      id: newId,
      marketYear: nextYear,
      editionNumber: "Nouvelle édition",
      posterImageUrl: "https://i.ibb.co/3y3KRNW4/Affiche-March.jpg",
      currentMarket: false
    }, { merge: true });

    setSelectedConfigId(newId);
    toast({
      title: "Nouvelle édition créée",
      description: `Vous pouvez maintenant configurer l'année ${nextYear}.`,
    });
  };

  const updateStatus = (id: string, status: ApplicationStatus, additionalData = {}) => {
    const docRef = doc(db, 'pre_registrations', id);
    updateDocumentNonBlocking(docRef, { status, ...additionalData });
  };

  const handleDelete = (id: string) => {
    const docRef = doc(db, 'pre_registrations', id);
    deleteDocumentNonBlocking(docRef);
    toast({
      title: "Candidature supprimée",
      description: "Le dossier a été retiré de la base de données.",
    });
  };

  const handleAcceptAndSend = async (exhibitor: Exhibitor) => {
    setIsSending(true);
    try {
      const result = await sendAcceptanceEmail(exhibitor, acceptanceMessage, currentConfig);
      if (result.success) {
        updateStatus(exhibitor.id, 'accepted_form1');
        toast({
          title: "Candidature acceptée",
          description: `L'e-mail a été envoyé à ${exhibitor.email}.`,
        });
      } else {
        toast({
          variant: "destructive",
          title: "Erreur d'envoi",
          description: "Impossible d'envoyer l'e-mail d'acceptation.",
        });
      }
    } catch (error) {
      console.error(error);
    } finally {
      setIsSending(false);
      setAcceptanceMessage('');
    }
  };

  const handleConfirmReject = async (exhibitor: Exhibitor) => {
    if (!justification) {
      toast({
        variant: "destructive",
        title: "Justification requise",
        description: "Veuillez générer ou saisir un motif de refus.",
      });
      return;
    }

    setIsSending(true);
    try {
      const result = await sendRejectionEmail(exhibitor, justification, currentConfig);
      if (result.success) {
        updateStatus(exhibitor.id, 'rejected', { rejectionJustification: justification });
        toast({
          title: "Refus envoyé",
          description: `L'e-mail de refus a été envoyé à ${exhibitor.email}.`,
        });
        setJustification('');
      } else {
        toast({
          variant: "destructive",
          title: "Erreur d'envoi",
          description: "Impossible d'envoyer l'e-mail de refus.",
        });
      }
    } catch (error) {
      console.error(error);
    } finally {
      setIsSending(false);
    }
  };

  const handleGenerateRejectIA = async (exhibitor: Exhibitor, reasons: string[]) => {
    setIsGenerating(true);
    try {
      const result = await generateRejectionJustification({
        applicantName: `${exhibitor.firstName} ${exhibitor.lastName}`,
        applicationSummary: exhibitor.productDescription,
        rejectionReasons: reasons,
      });
      setJustification(result.justificationMessage);
    } catch (error) {
      console.error(error);
    } finally {
      setIsGenerating(false);
    }
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

  if (isUserLoading || isConfigsLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="w-10 h-10 animate-spin text-primary" />
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen bg-background relative flex items-center justify-center p-4">
        <ChristmasSnow />
        <Card className="max-w-md w-full border-t-8 border-t-primary shadow-2xl relative z-10">
          <CardHeader className="text-center">
            <div className="mx-auto w-20 h-20 rounded-full border-4 border-primary/10 overflow-hidden mb-4 bg-white">
              <Image src={logoUrl} alt="Logo" width={80} height={80} className="object-cover" />
            </div>
            <CardTitle className="text-2xl font-headline font-bold text-primary">Accès Administration</CardTitle>
            <CardDescription>Portail réservé aux organisateurs.</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleLogin} className="space-y-4">
              <div className="space-y-2">
                <label className="text-sm font-bold text-muted-foreground uppercase">E-mail</label>
                <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-bold text-muted-foreground uppercase">Mot de passe</label>
                <Input type="password" value={password} onChange={(e) => setPassword(e.target.value)} required />
              </div>
              {loginError && <p className="text-xs text-destructive font-bold">{loginError}</p>}
              <Button type="submit" className="w-full h-12 text-lg font-bold gap-2 bg-primary hover:bg-primary/90 text-white">
                <LogIn className="w-5 h-5" /> Se connecter
              </Button>
            </form>
            <div className="mt-6 flex items-start gap-2 text-[10px] text-muted-foreground bg-muted/50 p-3 rounded-lg border">
              <ShieldAlert className="w-4 h-4 shrink-0 text-amber-500" />
              <p>L'accès est limité aux e-mails autorisés (ex: hugues.rabier@gmail.com).</p>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <ChristmasSnow />
      
      <div className="bg-primary text-white py-4 shadow-lg relative z-10">
        <div className="container mx-auto px-4 flex justify-between items-center">
          <div className="flex items-center gap-4">
            <div className="relative w-14 h-14 overflow-hidden rounded-full border-2 border-white/20">
              <Image src={logoUrl} alt="Logo" fill className="object-cover" />
            </div>
            <div>
              <h1 className="text-xl font-headline font-bold">Admin : Le Marché de Félix</h1>
              <p className="text-xs opacity-80 uppercase tracking-widest">{user.email}</p>
            </div>
          </div>
          <div className="flex gap-4">
            <Button asChild variant="secondary" size="sm" className="bg-accent text-accent-foreground hover:bg-accent/90">
              <Link href="/">Voir le site</Link>
            </Button>
            <Button onClick={() => auth.signOut()} variant="outline" size="sm" className="bg-white/10 border-white/20 text-white hover:bg-white/20">
              Déconnexion
            </Button>
          </div>
        </div>
      </div>

      <main className="container mx-auto px-4 py-10 relative z-10 space-y-8">
        
        <Tabs defaultValue="exhibitors" className="space-y-8">
          <TabsList className="bg-white/50 backdrop-blur border">
            <TabsTrigger value="exhibitors" className="gap-2"><FileText className="w-4 h-4" /> Candidatures</TabsTrigger>
            <TabsTrigger value="settings" className="gap-2"><Settings className="w-4 h-4" /> Paramètres Marché</TabsTrigger>
            <TabsTrigger value="access" className="gap-2"><Users className="w-4 h-4" /> Gestion Accès</TabsTrigger>
          </TabsList>

          <TabsContent value="exhibitors" className="space-y-8">
            <div className="grid md:grid-cols-3 gap-6 items-start">
              <Card className="md:col-span-1 bg-white/95 backdrop-blur border-l-4 border-l-primary shadow-lg">
                <CardHeader className="pb-4">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-lg flex items-center gap-2">
                      <Calendar className="w-5 h-5 text-primary" /> Édition
                    </CardTitle>
                    <Button variant="ghost" size="icon" onClick={handleCreateNewEdition} title="Ajouter une année">
                      <Plus className="w-4 h-4 text-primary" />
                    </Button>
                  </div>
                </CardHeader>
                <CardContent>
                  <Select value={selectedConfigId} onValueChange={setSelectedConfigId}>
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder="Choisir une édition" />
                    </SelectTrigger>
                    <SelectContent>
                      {configs?.map((config) => (
                        <SelectItem key={config.id} value={config.id}>
                          Marché {config.marketYear} {config.currentMarket && "(Actuel)"}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </CardContent>
              </Card>

              <div className="md:col-span-2 grid grid-cols-3 gap-4">
                <Card className="bg-white/80 backdrop-blur border-t-4 border-t-primary">
                  <CardHeader className="pb-2"><CardTitle className="text-xs uppercase text-muted-foreground">À Étudier</CardTitle></CardHeader>
                  <CardContent><div className="text-2xl font-bold text-primary">{stats.pending}</div></CardContent>
                </Card>
                <Card className="bg-white/80 backdrop-blur border-t-4 border-t-secondary">
                  <CardHeader className="pb-2"><CardTitle className="text-xs uppercase text-muted-foreground">En cours</CardTitle></CardHeader>
                  <CardContent><div className="text-2xl font-bold text-secondary">{stats.accepted}</div></CardContent>
                </Card>
                <Card className="bg-white/80 backdrop-blur border-t-4 border-t-accent">
                  <CardHeader className="pb-2"><CardTitle className="text-xs uppercase text-muted-foreground">Validés</CardTitle></CardHeader>
                  <CardContent><div className="text-2xl font-bold text-accent">{stats.validated}</div></CardContent>
                </Card>
              </div>
            </div>

            <div className="relative w-full md:w-96">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input placeholder="Rechercher..." className="pl-10" value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} />
            </div>

            <Card className="overflow-hidden border-none shadow-xl">
              <Table>
                <TableHeader className="bg-muted/50">
                  <TableRow>
                    <TableHead>Exposant</TableHead>
                    <TableHead>Localisation</TableHead>
                    <TableHead>Tables</TableHead>
                    <TableHead>Statut</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {isExhibitorsLoading ? (
                    <TableRow><TableCell colSpan={5} className="text-center py-10"><Loader2 className="w-6 h-6 animate-spin mx-auto text-primary" /></TableCell></TableRow>
                  ) : filteredExhibitors.map((exhibitor) => (
                    <TableRow key={exhibitor.id} className="hover:bg-muted/30">
                      <TableCell>
                        <div className="font-semibold">{exhibitor.companyName}</div>
                        <div className="text-xs text-muted-foreground">{exhibitor.firstName} {exhibitor.lastName}</div>
                      </TableCell>
                      <TableCell><div className="text-xs">{exhibitor.city} ({exhibitor.postalCode})</div></TableCell>
                      <TableCell><Badge variant="outline">{exhibitor.requestedTables}</Badge></TableCell>
                      <TableCell>
                        {exhibitor.status === 'pending' && <Badge variant="secondary">À étudier</Badge>}
                        {exhibitor.status === 'accepted_form1' && <Badge className="bg-blue-100 text-blue-800">Mail 2 envoyé</Badge>}
                        {exhibitor.status === 'submitted_form2' && <Badge className="bg-orange-100 text-orange-800">Dossier reçu</Badge>}
                        {exhibitor.status === 'validated' && <Badge className="bg-green-100 text-green-800">Validé</Badge>}
                        {exhibitor.status === 'rejected' && <Badge variant="destructive">Refusé</Badge>}
                      </TableCell>
                      <TableCell className="text-right space-x-2">
                        <Button asChild variant="outline" size="sm" title="Voir Form. 2">
                          <Link href={`/details/${exhibitor.id}`}><Eye className="w-4 h-4" /></Link>
                        </Button>
                        {/* Dossier detailed view logic here (Dialog reuse) */}
                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <Button variant="outline" size="sm" className="text-destructive"><Trash2 className="w-4 h-4" /></Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader><AlertDialogTitle>Supprimer ?</AlertDialogTitle></AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>Annuler</AlertDialogCancel>
                              <AlertDialogAction onClick={() => handleDelete(exhibitor.id)}>Supprimer</AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </Card>
          </TabsContent>

          <TabsContent value="settings" className="space-y-6">
            <Card className="bg-white/95 border-l-4 border-l-accent shadow-lg">
              <CardHeader>
                <CardTitle className="flex items-center gap-2"><Settings className="w-5 h-5 text-accent" /> Paramètres de l'édition {configForm.marketYear}</CardTitle>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="grid md:grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <label className="text-xs font-bold uppercase">Année du marché</label>
                    <Input type="number" value={configForm.marketYear} onChange={(e) => setConfigForm({...configForm, marketYear: parseInt(e.target.value)})} />
                  </div>
                  <div className="space-y-2">
                    <label className="text-xs font-bold uppercase">Numéro d'édition</label>
                    <Input value={configForm.editionNumber} onChange={(e) => setConfigForm({...configForm, editionNumber: e.target.value})} />
                  </div>
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-bold uppercase">URL de l'affiche publicitaire</label>
                  <Input value={configForm.posterImageUrl} onChange={(e) => setConfigForm({...configForm, posterImageUrl: e.target.value})} placeholder="https://..." />
                </div>
                <Button onClick={handleSaveConfig} disabled={isSavingConfig} className="bg-accent text-accent-foreground hover:bg-accent/90 gap-2">
                  {isSavingConfig ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />} Enregistrer les modifications
                </Button>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="access" className="space-y-6">
            <div className="grid md:grid-cols-3 gap-6">
              <Card className="md:col-span-1 bg-white/95 border-l-4 border-l-secondary shadow-lg">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2"><UserPlus className="w-5 h-5 text-secondary" /> Ajouter un accès</CardTitle>
                  <CardDescription>Donnez les droits d'administration à un nouveau membre.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <label className="text-xs font-bold uppercase">E-mail</label>
                    <Input value={newAdminEmail} onChange={(e) => setNewAdminEmail(e.target.value)} placeholder="nom@exemple.com" />
                  </div>
                  <div className="space-y-2">
                    <label className="text-xs font-bold uppercase">UID Firebase</label>
                    <Input value={newAdminUid} onChange={(e) => setNewAdminUid(e.target.value)} placeholder="ID unique de l'utilisateur" />
                  </div>
                  <Button onClick={handleAddAdmin} disabled={isAddingAdmin} className="w-full bg-secondary hover:bg-secondary/90 text-white gap-2">
                    {isAddingAdmin ? <Loader2 className="w-4 h-4 animate-spin" /> : <ShieldCheck className="w-4 h-4" />} Autoriser l'accès
                  </Button>
                  <p className="text-[10px] text-muted-foreground italic">L'utilisateur doit d'abord créer son compte via le formulaire de connexion pour obtenir son UID.</p>
                </CardContent>
              </Card>

              <Card className="md:col-span-2 bg-white/95 border-l-4 border-l-primary shadow-lg">
                <CardHeader><CardTitle>Administrateurs Autorisés</CardTitle></CardHeader>
                <CardContent>
                  <Table>
                    <TableHeader><TableRow><TableHead>E-mail</TableHead><TableHead>UID</TableHead><TableHead className="text-right">Actions</TableHead></TableRow></TableHeader>
                    <TableBody>
                      {isAdminsLoading ? (
                        <TableRow><TableCell colSpan={3} className="text-center"><Loader2 className="w-4 h-4 animate-spin mx-auto" /></TableCell></TableRow>
                      ) : adminUsers?.map((admin) => (
                        <TableRow key={admin.id}>
                          <TableCell className="font-medium">{admin.email}</TableCell>
                          <TableCell className="text-xs font-mono text-muted-foreground">{admin.uid}</TableCell>
                          <TableCell className="text-right">
                            {admin.email !== "hugues.rabier@gmail.com" && (
                              <Button variant="ghost" size="sm" onClick={() => handleRemoveAdmin(admin.uid)} className="text-destructive"><Trash2 className="w-4 h-4" /></Button>
                            )}
                          </TableCell>
                        </TableRow>
                      ))}
                      <TableRow>
                        <TableCell className="font-bold text-primary italic">hugues.rabier@gmail.com</TableCell>
                        <TableCell className="text-xs italic">Super Administrateur (Immuable)</TableCell>
                        <TableCell></TableCell>
                      </TableRow>
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
            </div>
          </TabsContent>
        </Tabs>

        <div className="text-center py-6">
          <p className="flex items-center justify-center gap-2 text-secondary font-bold text-sm uppercase tracking-wider">
            <Heart className="w-4 h-4 fill-secondary" /> Soutien à l'association "Un jardin pour Félix"
          </p>
        </div>
      </main>
    </div>
  );
}
