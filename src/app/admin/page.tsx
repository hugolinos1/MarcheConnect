
"use client"
import React, { useEffect, useState } from 'react';
import { Exhibitor, ApplicationStatus } from '@/lib/types';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ChristmasSnow } from '@/components/ChristmasSnow';
import { CheckCircle, XCircle, FileText, Search, Eye, EyeOff, Loader2, Camera, Fingerprint, Clock, ShieldCheck, Euro } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { generateRejectionJustification } from '@/ai/flows/generate-rejection-justification';
import { Textarea } from '@/components/ui/textarea';
import Link from 'next/link';
import { sendAcceptanceEmail, sendRejectionEmail } from '@/app/actions/email-actions';
import { useToast } from '@/hooks/use-toast';
import { useFirestore, useMemoFirebase, useCollection, useUser, useAuth, useDoc } from '@/firebase';
import { collection, doc, query, where, orderBy } from 'firebase/firestore';
import { updateDocumentNonBlocking, setDocumentNonBlocking } from '@/firebase/non-blocking-updates';
import { initiateEmailSignIn, initiateEmailSignUp } from '@/firebase/non-blocking-login';
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
    return query(collection(db, 'pre_registrations'), where('marketConfigurationId', '==', selectedConfigId));
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
        setAuthError("Email ou mot de passe incorrect.");
      })
      .finally(() => setIsAuthLoading(false));
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
              {authError && <p className="text-xs text-destructive text-center">{authError}</p>}
              <Button type="submit" disabled={isAuthLoading} className="w-full">Se connecter</Button>
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
            <img src={logoUrl} alt="Logo" width={40} height={40} className="rounded-full" />
            <h1 className="text-lg font-bold">Admin Marché de Félix</h1>
          </div>
          <Button onClick={() => auth.signOut()} variant="ghost" size="sm" className="text-white">Déconnexion</Button>
        </div>
      </div>

      <main className="container mx-auto px-4 py-8 space-y-8">
        <Tabs defaultValue="exhibitors">
          <TabsList className="mb-6">
            <TabsTrigger value="exhibitors">Candidatures</TabsTrigger>
            <TabsTrigger value="settings">Paramètres Marché</TabsTrigger>
          </TabsList>

          <TabsContent value="exhibitors" className="space-y-6">
            <div className="flex flex-col md:flex-row gap-4 items-center">
              <div className="relative flex-1 w-full">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input placeholder="Rechercher..." className="pl-10" value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} />
              </div>
            </div>

            <Card className="overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow><TableHead>Exposant</TableHead><TableHead>Statut</TableHead><TableHead className="text-right">Actions</TableHead></TableRow>
                </TableHeader>
                <TableBody>
                  {isExhibitorsLoading ? <TableRow><TableCell colSpan={3} className="text-center py-8"><Loader2 className="animate-spin mx-auto" /></TableCell></TableRow> :
                    filteredExhibitors.map(exhibitor => (
                      <TableRow key={exhibitor.id}>
                        <TableCell>
                          <div className="font-bold">{exhibitor.companyName}</div>
                          <div className="text-xs text-muted-foreground">{exhibitor.firstName} {exhibitor.lastName}</div>
                        </TableCell>
                        <TableCell><Badge>{exhibitor.status}</Badge></TableCell>
                        <TableCell className="text-right">
                          <Button variant="outline" size="sm" onClick={() => setViewingExhibitor(exhibitor)}><Eye className="w-4 h-4" /></Button>
                        </TableCell>
                      </TableRow>
                    ))}
                </TableBody>
              </Table>
            </Card>
          </TabsContent>

          <TabsContent value="settings">
            <Card className="max-w-2xl mx-auto">
              <CardHeader><CardTitle>Configuration</CardTitle></CardHeader>
              <CardContent className="space-y-6">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2"><label className="text-sm font-bold">Prix 1 Table</label><Input type="number" value={configForm.priceTable1} onChange={(e) => setConfigForm({...configForm, priceTable1: parseFloat(e.target.value)})} /></div>
                  <div className="space-y-2"><label className="text-sm font-bold">Prix 2 Tables</label><Input type="number" value={configForm.priceTable2} onChange={(e) => setConfigForm({...configForm, priceTable2: parseFloat(e.target.value)})} /></div>
                </div>
                <Button onClick={handleSaveConfig} disabled={isSavingConfig} className="w-full">Enregistrer</Button>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </main>

      <Dialog open={!!viewingExhibitor} onOpenChange={(open) => !open && setViewingExhibitor(null)}>
        <DialogContent className="max-w-2xl max-h-[90vh]">
          <DialogHeader><DialogTitle className="flex items-center gap-2 text-primary"><FileText className="w-5 h-5" /> Dossier</DialogTitle></DialogHeader>
          <ScrollArea className="h-[70vh] pr-4">
            {viewingExhibitor && (
              <div className="space-y-6 py-4">
                <div className="grid grid-cols-2 gap-4 bg-muted/30 p-4 rounded-lg">
                  <div><p className="font-bold">{viewingExhibitor.companyName}</p></div>
                  <div><p>{viewingExhibitor.firstName} {viewingExhibitor.lastName}</p></div>
                </div>
                {viewingExhibitor.productImages && viewingExhibitor.productImages.length > 0 && (
                  <div className="grid grid-cols-3 gap-2">
                    {viewingExhibitor.productImages.map((img, i) => (
                      <img key={i} src={img} alt="" className="w-full aspect-square object-cover rounded border" />
                    ))}
                  </div>
                )}
                {viewingExhibitor.detailedInfo?.idCardPhoto && (
                  <div>
                    <p className="text-xs font-bold uppercase mb-1">Pièce d'identité</p>
                    <img src={viewingExhibitor.detailedInfo.idCardPhoto} alt="ID" className="w-full max-h-64 object-contain rounded border bg-white" />
                  </div>
                )}
              </div>
            )}
          </ScrollArea>
        </DialogContent>
      </Dialog>
    </div>
  );
}
