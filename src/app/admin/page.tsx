"use client"
import React, { useEffect, useState } from 'react';
import { Exhibitor } from '@/lib/types';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ChristmasSnow } from '@/components/ChristmasSnow';
import { CheckCircle, XCircle, FileText, Search, Mail, Loader2, Trash2, Eye, ShieldCheck, Sparkles, Download, Settings } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { generateRejectionJustification } from '@/ai/flows/generate-rejection-justification';
import { Textarea } from '@/components/ui/textarea';
import Link from 'next/link';
import { sendAcceptanceEmail, sendRejectionEmail, testSmtpOrange } from '@/app/actions/email-actions';
import { useToast } from '@/hooks/use-toast';
import { useFirestore, useMemoFirebase, useCollection, useUser, useAuth, useDoc } from '@/firebase';
import { collection, doc, query, orderBy, where } from 'firebase/firestore';
import { updateDocumentNonBlocking, setDocumentNonBlocking, deleteDocumentNonBlocking } from '@/firebase/non-blocking-updates';
import { initiateEmailSignIn } from '@/firebase/non-blocking-login';
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
    initiateEmailSignIn(auth, email, password)
      .catch(() => setAuthError("Erreur d'authentification."))
      .finally(() => setIsAuthLoading(false));
  };

  const handleSaveConfig = () => {
    const configId = selectedConfigId || `config-${configForm.marketYear}`;
    setDocumentNonBlocking(doc(db, 'market_configurations', configId), { ...configForm, id: configId, currentMarket: true }, { merge: true });
    toast({ title: "Paramètres enregistrés" });
  };

  const handleAcceptAndSend = async () => {
    if (!actingExhibitor) return;
    
    // Fermeture immédiate du dialogue pour une interface fluide
    setIsAcceptDialogOpen(false);
    setIsSending(true);
    
    // 1. Mise à jour Firestore IMMÉDIATE
    updateDocumentNonBlocking(doc(db, 'pre_registrations', actingExhibitor.id), { status: 'accepted_form1' });

    try {
      // 2. Tentative d'envoi de l'e-mail
      const result = await sendAcceptanceEmail(actingExhibitor, acceptanceMessage, currentConfig);
      
      if (result.success) {
        toast({ title: "Candidature acceptée", description: "L'e-mail a été envoyé." });
      } else {
        toast({ 
          variant: "destructive", 
          title: "Email non envoyé", 
          description: `Dossier accepté en base, mais échec SMTP Orange (Antispam).` 
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
    setIsRejectDialogOpen(false);
    setIsSending(true);
    
    updateDocumentNonBlocking(doc(db, 'pre_registrations', actingExhibitor.id), { 
      status: 'rejected', 
      rejectionJustification: justification 
    });

    try {
      const result = await sendRejectionEmail(actingExhibitor, justification, currentConfig);
      if (result.success) {
        toast({ title: "Candidature refusée", description: "L'e-mail a été envoyé." });
      } else {
        toast({ variant: "destructive", title: "Email non envoyé", description: "Refus enregistré mais échec SMTP." });
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
    toast({ title: "Test SMTP en cours..." });
    const res = await testSmtpOrange();
    if (res.success) {
      toast({ title: "Test SMTP Réussi", description: "L'e-mail a bien été envoyé." });
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

  if (!user || !isAuthorized) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
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
          <TabsList className="mb-6"><TabsTrigger value="exhibitors">Candidatures</TabsTrigger><TabsTrigger value="settings">Configuration</TabsTrigger></TabsList>

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
                <div className="pt-4 space-y-4">
                  <Button onClick={handleSaveConfig} className="w-full font-bold">Enregistrer la configuration</Button>
                  <Button onClick={handleTestSmtp} variant="outline" className="w-full border-primary text-primary">Tester la connexion SMTP Orange</Button>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </main>

      <Dialog open={isAcceptDialogOpen} onOpenChange={setIsAcceptDialogOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Accepter {actingExhibitor?.companyName}</DialogTitle></DialogHeader>
          <div className="py-4 space-y-4">
            <p className="text-sm text-muted-foreground">L'email contiendra le lien vers le formulaire de finalisation.</p>
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
        <DialogContent className="max-w-2xl max-h-[90vh]">
          <DialogHeader><DialogTitle className="text-primary flex items-center gap-2"><FileText className="w-6 h-6" /> Dossier de {viewingExhibitor?.companyName}</DialogTitle></DialogHeader>
          <ScrollArea className="pr-4 h-[70vh]">
            {viewingExhibitor && (
              <div className="space-y-6 py-4">
                <section className="grid grid-cols-2 gap-4 bg-muted/30 p-4 rounded-lg">
                  <div><p className="text-[10px] font-bold uppercase text-muted-foreground">Contact</p><p className="font-bold">{viewingExhibitor.firstName} {viewingExhibitor.lastName}</p></div>
                  <div><p className="text-[10px] font-bold uppercase text-muted-foreground">Ville</p><p>{viewingExhibitor.city}</p></div>
                  <div className="col-span-2"><p className="text-[10px] font-bold uppercase text-muted-foreground">Description</p><p className="text-sm italic">{viewingExhibitor.productDescription}</p></div>
                </section>
                
                {viewingExhibitor.productImages && viewingExhibitor.productImages.length > 0 && (
                  <div className="grid grid-cols-3 gap-2">
                    {viewingExhibitor.productImages.map((img, idx) => (
                      <div key={idx} className="relative aspect-square rounded-md overflow-hidden border">
                        <img src={img} alt="Produit" className="object-cover w-full h-full" />
                      </div>
                    ))}
                  </div>
                )}

                {viewingExhibitor.detailedInfo && (
                  <section className="space-y-3 p-4 border-2 border-primary/10 rounded-xl bg-primary/5">
                    <h4 className="text-sm font-bold text-primary underline">DOSSIER TECHNIQUE FINAL</h4>
                    <div className="grid grid-cols-2 gap-2 text-sm">
                      <div><p className="text-[10px] font-bold">Electricité</p><p>{viewingExhibitor.detailedInfo.needsElectricity ? "OUI" : "NON"}</p></div>
                      <div><p className="text-[10px] font-bold">Repas</p><p>{viewingExhibitor.detailedInfo.sundayLunchCount} plateaux</p></div>
                      <div className="col-span-2"><p className="text-[10px] font-bold">Assurance</p><p>{viewingExhibitor.detailedInfo.insuranceCompany} ({viewingExhibitor.detailedInfo.insurancePolicyNumber})</p></div>
                    </div>
                    {viewingExhibitor.detailedInfo.idCardPhoto && (
                      <div className="mt-2">
                        <p className="text-[10px] font-bold mb-1">PIÈCE D'IDENTITÉ</p>
                        <img src={viewingExhibitor.detailedInfo.idCardPhoto} alt="ID" className="w-full rounded border" />
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