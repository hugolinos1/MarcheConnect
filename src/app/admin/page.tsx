"use client"
import React, { useEffect, useState } from 'react';
import { Exhibitor, ApplicationStatus } from '@/lib/types';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { ChristmasSnow } from '@/components/ChristmasSnow';
import { CheckCircle, XCircle, FileText, Search, Mail, Loader2, Trash2, Eye, ShieldCheck, Sparkles, Download, ArrowRight } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { generateRejectionJustification } from '@/ai/flows/generate-rejection-justification';
import { Textarea } from '@/components/ui/textarea';
import Link from 'next/link';
import { sendAcceptanceEmail, sendRejectionEmail } from '@/app/actions/email-actions';
import { useToast } from '@/hooks/use-toast';
import { useFirestore, useMemoFirebase, useCollection, useUser, useAuth, useDoc } from '@/firebase';
import { collection, doc, query, where, orderBy } from 'firebase/firestore';
import { updateDocumentNonBlocking, setDocumentNonBlocking, deleteDocumentNonBlocking } from '@/firebase/non-blocking-updates';
import { initiateEmailSignIn, initiateEmailSignUp } from '@/firebase/non-blocking-login';
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
  const [justification, setJustification] = useState('');
  const [acceptanceMessage, setAcceptanceMessage] = useState('');
  const [selectedConfigId, setSelectedConfigId] = useState<string>('');
  const [viewingExhibitor, setViewingExhibitor] = useState<Exhibitor | null>(null);
  
  const [isAcceptDialogOpen, setIsAcceptDialogOpen] = useState(false);
  const [isRejectDialogOpen, setIsRejectDialogOpen] = useState(false);
  const [actingExhibitor, setActingExhibitor] = useState<Exhibitor | null>(null);
  
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isSignUp, setIsSignUp] = useState(false);
  const [authError, setAuthError] = useState('');

  const logoUrl = "https://i.ibb.co/yncRPkvR/logo-ujpf.jpg";

  const userRoleRef = useMemoFirebase(() => {
    if (!user || !user.uid) return null;
    return doc(db, 'roles_admin', user.uid);
  }, [db, user]);
  const { data: userRoleDoc, isLoading: isRoleLoading } = useDoc(userRoleRef);

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
    authPromise.catch((err: any) => {
      setAuthError("Erreur d'authentification : Vérifiez vos identifiants.");
      toast({ variant: "destructive", title: "Erreur Auth", description: "Identifiants incorrects." });
    }).finally(() => setIsAuthLoading(false));
  };

  const handleSaveConfig = () => {
    const configId = selectedConfigId || `config-${configForm.marketYear}`;
    setDocumentNonBlocking(doc(db, 'market_configurations', configId), { ...configForm, id: configId, currentMarket: true }, { merge: true });
    toast({ title: "Paramètres enregistrés" });
  };

  const handleAcceptAndSend = async () => {
    if (!actingExhibitor) return;
    setIsSending(true);
    try {
      const result = await sendAcceptanceEmail(actingExhibitor, acceptanceMessage, currentConfig);
      
      // On met à jour le statut dans Firestore quoi qu'il arrive pour ne pas bloquer l'admin
      updateDocumentNonBlocking(doc(db, 'pre_registrations', actingExhibitor.id), { status: 'accepted_form1' });
      
      if (result.success) {
        toast({ title: "Candidature acceptée", description: "L'email a été envoyé avec succès." });
      } else {
        toast({ 
          variant: "destructive", 
          title: "Email non envoyé", 
          description: "La candidature est acceptée dans le système, mais l'email a échoué (vérifiez vos réglages SMTP)." 
        });
      }
      setIsAcceptDialogOpen(false);
      setAcceptanceMessage('');
    } catch (err) {
      toast({ title: "Erreur technique", description: "Une erreur est survenue lors du traitement.", variant: "destructive" });
    } finally {
      setIsSending(false);
    }
  };

  const handleConfirmReject = async () => {
    if (!actingExhibitor || !justification) return;
    setIsSending(true);
    try {
      const result = await sendRejectionEmail(actingExhibitor, justification, currentConfig);
      
      // Mise à jour du statut même si l'email échoue
      updateDocumentNonBlocking(doc(db, 'pre_registrations', actingExhibitor.id), { status: 'rejected', rejectionJustification: justification });
      
      if (result.success) {
        toast({ title: "Refus enregistré", description: "L'email de refus a été envoyé." });
      } else {
        toast({ 
          variant: "destructive", 
          title: "Email de refus échoué", 
          description: "Le statut est mis à jour, mais l'email n'est pas parti." 
        });
      }
      setIsRejectDialogOpen(false);
      setJustification('');
    } catch (err) {
      toast({ title: "Erreur technique", variant: "destructive" });
    } finally {
      setIsSending(false);
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
    if (!exhibitorsData || exhibitorsData.length === 0) return;
    const exportData = filteredExhibitors.map(e => ({
      "Enseigne": e.companyName,
      "Nom": e.lastName,
      "Prénom": e.firstName,
      "Email": e.email,
      "Ville": e.city,
      "Tables": e.requestedTables,
      "Statut": e.status,
      "Electricité": e.detailedInfo?.needsElectricity ? "Oui" : "Non",
      "Repas": e.detailedInfo?.sundayLunchCount || 0
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

  if (!user || !isAuthorized) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        {!user ? (
          <Card className="max-w-md w-full">
            <CardHeader><CardTitle className="text-center text-primary">Administration</CardTitle></CardHeader>
            <CardContent>
              <form onSubmit={handleAuth} className="space-y-4">
                <Input type="email" placeholder="Email" value={email} onChange={(e) => setEmail(e.target.value)} required />
                <Input type="password" placeholder="Mot de passe" value={password} onChange={(e) => setPassword(e.target.value)} required />
                {authError && <p className="text-xs text-destructive text-center font-bold">{authError}</p>}
                <Button type="submit" disabled={isAuthLoading} className="w-full">{isAuthLoading ? <Loader2 className="animate-spin" /> : "Connexion"}</Button>
              </form>
            </CardContent>
          </Card>
        ) : (
          <Card className="max-w-md w-full text-center p-6"><ShieldCheck className="mx-auto w-12 h-12 text-amber-500" /><h2 className="mt-4 font-bold">Accès Restreint</h2><p className="text-sm mt-2">Votre compte ({user.email}) n'est pas autorisé.</p><Button onClick={() => auth.signOut()} className="mt-4" variant="outline">Déconnexion</Button></Card>
        )}
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
            <h1 className="text-lg font-bold">Admin : Le Marché de Félix</h1>
          </div>
          <div className="flex gap-2">
            <Button asChild variant="secondary" size="sm" className="font-bold"><Link href="/">Voir le site</Link></Button>
            <Button onClick={() => auth.signOut()} variant="ghost" size="sm" className="text-white border border-white/50">Déconnexion</Button>
          </div>
        </div>
      </div>

      <main className="container mx-auto px-4 py-8 space-y-8">
        <Tabs defaultValue="exhibitors">
          <TabsList className="mb-6"><TabsTrigger value="exhibitors">Candidatures</TabsTrigger><TabsTrigger value="settings">Paramètres</TabsTrigger></TabsList>

          <TabsContent value="exhibitors" className="space-y-6">
            <div className="flex flex-col md:flex-row gap-4 items-center">
              <div className="relative flex-1 w-full"><Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" /><Input placeholder="Rechercher un exposant..." className="pl-10" value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} /></div>
              <Button onClick={handleExportExcel} variant="outline" className="gap-2 border-primary/20 text-primary font-bold"><Download className="w-4 h-4" /> Exporter Excel</Button>
            </div>

            <Card className="overflow-hidden border-2">
              <Table>
                <TableHeader className="bg-muted/30">
                  <TableRow><TableHead>Exposant</TableHead><TableHead>Tables</TableHead><TableHead>Statut</TableHead><TableHead className="text-right">Actions</TableHead></TableRow>
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
                             exhibitor.status === 'validated' ? 'Validé (OK)' : 'Refusé'}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex justify-end gap-2">
                            <Button variant="outline" size="sm" onClick={() => setViewingExhibitor(exhibitor)} className="text-primary border-primary/30" title="Voir les détails"><Eye className="w-4 h-4" /></Button>
                            
                            {(exhibitor.status === 'pending' || exhibitor.status === 'rejected') && (
                              <Button size="sm" className="bg-green-600 hover:bg-green-700" onClick={() => { setActingExhibitor(exhibitor); setIsAcceptDialogOpen(true); }} title="Accepter"><CheckCircle className="w-4 h-4" /></Button>
                            )}
                            
                            {(exhibitor.status === 'pending' || exhibitor.status === 'accepted_form1') && (
                              <Button variant="destructive" size="sm" onClick={() => { setActingExhibitor(exhibitor); setIsRejectDialogOpen(true); }} title="Refuser"><XCircle className="w-4 h-4" /></Button>
                            )}
                            
                            {exhibitor.status === 'submitted_form2' && (
                              <Button size="sm" className="bg-blue-600 hover:bg-blue-700" onClick={() => updateDocumentNonBlocking(doc(db, 'pre_registrations', exhibitor.id), { status: 'validated' })} title="Valider définitivement"><ShieldCheck className="w-4 h-4" /></Button>
                            )}

                            <AlertDialog>
                              <AlertDialogTrigger asChild><Button variant="outline" size="sm" className="text-destructive border-destructive/20 hover:bg-destructive/10" title="Supprimer"><Trash2 className="w-4 h-4" /></Button></AlertDialogTrigger>
                              <AlertDialogContent>
                                <AlertDialogHeader><AlertDialogTitle>Supprimer définitivement ?</AlertDialogTitle><AlertDialogDescription>Cette action est irréversible. Toutes les données de {exhibitor.companyName} seront effacées.</AlertDialogDescription></AlertDialogHeader>
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

          <TabsContent value="settings">
            <Card className="max-w-2xl mx-auto shadow-md border-t-4 border-t-primary">
              <CardHeader><CardTitle className="text-primary">Configuration du Marché</CardTitle></CardHeader>
              <CardContent className="space-y-6">
                 <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2"><label className="text-xs font-bold">Année</label><Input type="number" value={configForm.marketYear} onChange={(e) => setConfigForm({...configForm, marketYear: parseInt(e.target.value)})} /></div>
                  <div className="space-y-2"><label className="text-xs font-bold">Édition</label><Input value={configForm.editionNumber} onChange={(e) => setConfigForm({...configForm, editionNumber: e.target.value})} /></div>
                </div>
                <div className="space-y-2"><label className="text-xs font-bold">URL de l'Affiche</label><Input value={configForm.posterImageUrl} onChange={(e) => setConfigForm({...configForm, posterImageUrl: e.target.value})} /></div>
                <div className="space-y-2"><label className="text-xs font-bold">Email de notification (Admin)</label><Input value={configForm.notificationEmail} onChange={(e) => setConfigForm({...configForm, notificationEmail: e.target.value})} /></div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2"><label className="text-xs font-bold">Prix 1 Table (€)</label><Input type="number" value={configForm.priceTable1} onChange={(e) => setConfigForm({...configForm, priceTable1: parseFloat(e.target.value)})} /></div>
                  <div className="space-y-2"><label className="text-xs font-bold">Prix 2 Tables (€)</label><Input type="number" value={configForm.priceTable2} onChange={(e) => setConfigForm({...configForm, priceTable2: parseFloat(e.target.value)})} /></div>
                </div>
                <Button onClick={handleSaveConfig} className="w-full font-bold">Enregistrer les paramètres</Button>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </main>

      {/* Accept Dialog */}
      <Dialog open={isAcceptDialogOpen} onOpenChange={setIsAcceptDialogOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Accepter {actingExhibitor?.companyName}</DialogTitle></DialogHeader>
          <div className="py-4 space-y-4">
            <p className="text-sm text-muted-foreground">L'exposant passera en statut "Accepté" et recevra un lien vers le dossier technique.</p>
            <Textarea placeholder="Ajouter un message personnel dans l'email (optionnel)..." value={acceptanceMessage} onChange={(e) => setAcceptanceMessage(e.target.value)} rows={4} />
          </div>
          <DialogFooter className="flex-col sm:flex-row gap-2">
            <Button variant="outline" onClick={() => setIsAcceptDialogOpen(false)}>Annuler</Button>
            <Button onClick={handleAcceptAndSend} disabled={isSending}>{isSending ? <Loader2 className="animate-spin mr-2" /> : <Mail className="w-4 h-4 mr-2" />} Confirmer et Envoyer</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Reject Dialog */}
      <Dialog open={isRejectDialogOpen} onOpenChange={setIsRejectDialogOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Refuser la candidature</DialogTitle></DialogHeader>
          <div className="py-4 space-y-4">
            <div className="flex flex-wrap gap-2">
              <Button variant="outline" size="sm" onClick={() => handleGenerateRejectIA(["Manque de place"])} disabled={isGenerating}><Sparkles className="w-3 h-3 mr-2" />IA: Place</Button>
              <Button variant="outline" size="sm" onClick={() => handleGenerateRejectIA(["Produits non artisanaux"])} disabled={isGenerating}><Sparkles className="w-3 h-3 mr-2" />IA: Artisanat</Button>
            </div>
            <Textarea value={justification} onChange={(e) => setJustification(e.target.value)} placeholder="Motif détaillé du refus (sera envoyé par mail)..." rows={6} />
          </div>
          <DialogFooter className="flex-col sm:flex-row gap-2">
            <Button variant="outline" onClick={() => setIsRejectDialogOpen(false)}>Annuler</Button>
            <Button variant="destructive" onClick={handleConfirmReject} disabled={isSending || !justification}>{isSending ? <Loader2 className="animate-spin mr-2" /> : <XCircle className="w-4 h-4 mr-2" />} Envoyer le refus</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Details Dialog */}
      <Dialog open={!!viewingExhibitor} onOpenChange={(open) => !open && setViewingExhibitor(null)}>
        <DialogContent className="max-w-2xl max-h-[90vh]">
          <DialogHeader><DialogTitle className="text-primary flex items-center gap-2"><FileText className="w-6 h-6" /> Dossier de {viewingExhibitor?.companyName}</DialogTitle></DialogHeader>
          <ScrollArea className="pr-4 h-[70vh]">
            {viewingExhibitor && (
              <div className="space-y-6 py-4">
                <section className="grid grid-cols-2 gap-4 bg-muted/30 p-4 rounded-lg">
                  <div><p className="text-[10px] font-bold uppercase text-muted-foreground">Contact</p><p className="font-bold">{viewingExhibitor.firstName} {viewingExhibitor.lastName}</p></div>
                  <div><p className="text-[10px] font-bold uppercase text-muted-foreground">Ville</p><p>{viewingExhibitor.city} ({viewingExhibitor.postalCode})</p></div>
                  <div className="col-span-2"><p className="text-[10px] font-bold uppercase text-muted-foreground">Description Produits</p><p className="text-sm italic">{viewingExhibitor.productDescription}</p></div>
                </section>
                
                {viewingExhibitor.productImages && viewingExhibitor.productImages.length > 0 && (
                  <section className="space-y-2">
                    <h4 className="text-sm font-bold border-b pb-1">Photos soumises</h4>
                    <div className="grid grid-cols-3 gap-2">
                      {viewingExhibitor.productImages.map((img, idx) => (
                        <div key={idx} className="relative aspect-square rounded-md overflow-hidden border">
                          <img src={img} alt="Produit" className="object-cover w-full h-full" />
                        </div>
                      ))}
                    </div>
                  </section>
                )}

                {viewingExhibitor.detailedInfo && (
                  <section className="space-y-3 p-4 border-2 border-primary/10 rounded-xl bg-primary/5">
                    <h4 className="text-sm font-bold flex items-center gap-2 text-primary underline"><ShieldCheck className="w-4 h-4" /> DOSSIER TECHNIQUE FINAL</h4>
                    <div className="grid grid-cols-2 gap-y-4 gap-x-6 text-sm">
                      <div><p className="text-[10px] font-bold">SIRET</p><p>{viewingExhibitor.detailedInfo.siret || "N/A"}</p></div>
                      <div><p className="text-[10px] font-bold">Electricité</p><p>{viewingExhibitor.detailedInfo.needsElectricity ? "OUI" : "NON"}</p></div>
                      <div><p className="text-[10px] font-bold">Grille</p><p>{viewingExhibitor.detailedInfo.needsGrid ? "OUI" : "NON"}</p></div>
                      <div><p className="text-[10px] font-bold">Repas Dimanche</p><p className="font-bold text-primary">{viewingExhibitor.detailedInfo.sundayLunchCount} plateaux</p></div>
                      <div className="col-span-2"><p className="text-[10px] font-bold">Assurance</p><p>{viewingExhibitor.detailedInfo.insuranceCompany} (Police: {viewingExhibitor.detailedInfo.insurancePolicyNumber})</p></div>
                    </div>
                    {viewingExhibitor.detailedInfo.idCardPhoto && (
                      <div className="mt-4">
                        <p className="text-[10px] font-bold mb-1">PIÈCE D'IDENTITÉ</p>
                        <div className="relative aspect-video rounded-lg overflow-hidden border bg-white">
                          <img src={viewingExhibitor.detailedInfo.idCardPhoto} alt="ID Card" className="object-contain w-full h-full" />
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