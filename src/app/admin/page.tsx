"use client"
import React, { useEffect, useState } from 'react';
import { Exhibitor, ApplicationStatus } from '@/lib/types';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { ChristmasSnow } from '@/components/ChristmasSnow';
import { CheckCircle, XCircle, FileText, Search, UserCheck, Globe, MapPin, Ticket, Zap, Utensils, Heart, Mail, Loader2, Trash2 } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { generateRejectionJustification } from '@/ai/flows/generate-rejection-justification';
import { Textarea } from '@/components/ui/textarea';
import Link from 'next/link';
import Image from 'next/image';
import { sendAcceptanceEmail, sendRejectionEmail } from '@/app/actions/email-actions';
import { useToast } from '@/hooks/use-toast';

export default function AdminDashboard() {
  const { toast } = useToast();
  const [exhibitors, setExhibitors] = useState<Exhibitor[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [justification, setJustification] = useState('');
  const [acceptanceMessage, setAcceptanceMessage] = useState('');
  const [selectedExhibitor, setSelectedExhibitor] = useState<Exhibitor | null>(null);
  const logoUrl = "https://i.ibb.co/yncRPkvR/logo-ujpf.jpg";

  useEffect(() => {
    const data = JSON.parse(localStorage.getItem('exhibitors') || '[]');
    setExhibitors(data);
  }, []);

  const updateStatus = (id: string, status: ApplicationStatus, additionalData = {}) => {
    const updated = exhibitors.map(e => e.id === id ? { ...e, status, ...additionalData } : e);
    setExhibitors(updated);
    localStorage.setItem('exhibitors', JSON.stringify(updated));
  };

  const handleDelete = (id: string) => {
    const updated = exhibitors.filter(e => e.id !== id);
    setExhibitors(updated);
    localStorage.setItem('exhibitors', JSON.stringify(updated));
    toast({
      title: "Candidature supprimée",
      description: "Le dossier a été retiré de la base de données.",
    });
  };

  const handleAcceptAndSend = async (exhibitor: Exhibitor) => {
    setIsSending(true);
    try {
      const result = await sendAcceptanceEmail(exhibitor, acceptanceMessage);
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
      const result = await sendRejectionEmail(exhibitor, justification);
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

  const filteredExhibitors = exhibitors.filter(e => 
    e.companyName.toLowerCase().includes(searchTerm.toLowerCase()) ||
    `${e.firstName} ${e.lastName}`.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const stats = {
    pending: exhibitors.filter(e => e.status === 'pending').length,
    accepted: exhibitors.filter(e => ['accepted_form1', 'submitted_form2', 'validated'].includes(e.status)).length,
    validated: exhibitors.filter(e => e.status === 'validated').length,
  };

  return (
    <div className="min-h-screen bg-background">
      <ChristmasSnow />
      
      <div className="bg-primary text-white py-4 shadow-lg relative z-10">
        <div className="container mx-auto px-4 flex justify-between items-center">
          <div className="flex items-center gap-4">
            <div className="relative w-14 h-14 overflow-hidden rounded-full border-2 border-white/20">
              <Image 
                src={logoUrl}
                alt="Logo Un Jardin pour Félix"
                fill
                className="object-cover"
              />
            </div>
            <div>
              <h1 className="text-xl font-headline font-bold">Admin : Le Marché de Félix</h1>
              <p className="text-xs opacity-80">Gestion des candidatures 2026</p>
            </div>
          </div>
          <div className="flex gap-4">
            <Button asChild variant="secondary" size="sm" className="bg-accent text-accent-foreground hover:bg-accent/90">
              <Link href="/">Voir le site</Link>
            </Button>
          </div>
        </div>
      </div>

      <main className="container mx-auto px-4 py-10 relative z-10 space-y-8">
        <div className="grid md:grid-cols-3 gap-6">
          <Card className="bg-white/80 backdrop-blur border-t-4 border-t-primary">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground uppercase">À Étudier</CardTitle>
              <Search className="w-4 h-4 text-primary" />
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-primary">{stats.pending}</div>
            </CardContent>
          </Card>
          <Card className="bg-white/80 backdrop-blur border-t-4 border-t-secondary">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground uppercase">En cours / Acceptés</CardTitle>
              <CheckCircle className="w-4 h-4 text-secondary" />
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-secondary">{stats.accepted}</div>
            </CardContent>
          </Card>
          <Card className="bg-white/80 backdrop-blur border-t-4 border-t-accent">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground uppercase">Validés Final</CardTitle>
              <UserCheck className="w-4 h-4 text-accent" />
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-accent">{stats.validated}</div>
            </CardContent>
          </Card>
        </div>

        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div className="relative w-full md:w-96">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input 
              placeholder="Rechercher par nom ou enseigne..." 
              className="pl-10"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
        </div>

        <Card className="overflow-hidden border-none shadow-xl">
          <Table>
            <TableHeader className="bg-muted/50">
              <TableRow>
                <TableHead>Exposant / Enseigne</TableHead>
                <TableHead>Localisation</TableHead>
                <TableHead>Tables</TableHead>
                <TableHead>Statut</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredExhibitors.map((exhibitor) => (
                <TableRow key={exhibitor.id} className="hover:bg-muted/30">
                  <TableCell>
                    <div className="font-semibold">{exhibitor.companyName}</div>
                    <div className="text-xs text-muted-foreground">{exhibitor.firstName} {exhibitor.lastName}</div>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-1 text-xs">
                      <MapPin className="w-3 h-3 text-muted-foreground" />
                      {exhibitor.city} ({exhibitor.postalCode})
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline" className="border-primary/20">{exhibitor.requestedTables} table(s)</Badge>
                  </TableCell>
                  <TableCell>
                    {exhibitor.status === 'pending' && <Badge variant="secondary">À étudier</Badge>}
                    {exhibitor.status === 'accepted_form1' && <Badge className="bg-blue-100 text-blue-800">Finalisation envoyée</Badge>}
                    {exhibitor.status === 'submitted_form2' && <Badge className="bg-orange-100 text-orange-800">Dossier final reçu</Badge>}
                    {exhibitor.status === 'validated' && <Badge className="bg-green-100 text-green-800">Validé</Badge>}
                    {exhibitor.status === 'rejected' && <Badge variant="destructive">Refusé</Badge>}
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-2">
                      <Dialog>
                        <DialogTrigger asChild>
                          <Button variant="outline" size="sm" onClick={() => setSelectedExhibitor(exhibitor)}>
                            <FileText className="w-4 h-4" />
                          </Button>
                        </DialogTrigger>
                        <DialogContent className="max-w-3xl overflow-y-auto max-h-[90vh]">
                          <DialogHeader>
                            <DialogTitle>Dossier Candidature - {exhibitor.companyName}</DialogTitle>
                            <DialogDescription>
                              Déposé le {new Date(exhibitor.createdAt).toLocaleDateString()}
                            </DialogDescription>
                          </DialogHeader>
                          
                          <div className="space-y-6 py-4">
                            <div className="grid grid-cols-2 gap-4">
                              <div className="p-3 bg-muted/50 rounded-lg space-y-2">
                                <h4 className="text-xs font-bold uppercase text-muted-foreground">Profil</h4>
                                <p className="text-sm"><strong>Contact :</strong> {exhibitor.firstName} {exhibitor.lastName}</p>
                                <p className="text-sm"><strong>Email :</strong> {exhibitor.email}</p>
                                <p className="text-sm"><strong>Tel :</strong> {exhibitor.phone}</p>
                                <p className="text-sm flex items-center gap-1"><strong>Statut :</strong> {exhibitor.isRegistered ? 'Déclaré' : 'Particulier'}</p>
                              </div>
                              <div className="p-3 bg-muted/50 rounded-lg space-y-2">
                                <h4 className="text-xs font-bold uppercase text-muted-foreground">Logistique Demandée</h4>
                                <p className="text-sm"><strong>Tables :</strong> {exhibitor.requestedTables}</p>
                                <p className="text-sm"><strong>Ville :</strong> {exhibitor.city}</p>
                                <p className="text-sm"><strong>CP :</strong> {exhibitor.postalCode}</p>
                                {exhibitor.websiteUrl && (
                                  <p className="text-sm flex items-center gap-1">
                                    <strong>Web :</strong> 
                                    <a href={exhibitor.websiteUrl} target="_blank" className="text-primary hover:underline flex items-center gap-1">
                                      Lien <Globe className="w-3 h-3" />
                                    </a>
                                  </p>
                                )}
                              </div>
                            </div>

                            <div className="p-4 bg-primary/5 border border-primary/20 rounded-lg space-y-3">
                              <div>
                                <h4 className="font-bold text-primary mb-1 text-sm flex items-center gap-2"><MapPin className="w-4 h-4" /> Adresse complète :</h4>
                                <p className="text-sm italic">{exhibitor.address}, {exhibitor.postalCode} {exhibitor.city}</p>
                              </div>
                              <div>
                                <h4 className="font-bold text-primary mb-1 text-sm">Description / Nature du stand :</h4>
                                <p className="text-sm italic">{exhibitor.productDescription}</p>
                              </div>
                            </div>

                            {exhibitor.detailedInfo && (
                              <div className="p-4 border-2 border-secondary/20 rounded-lg space-y-4">
                                <h4 className="font-bold text-secondary flex items-center gap-2">
                                  <CheckCircle className="w-4 h-4" /> Dossier Finalisé
                                </h4>
                                <div className="grid grid-cols-2 gap-4 text-sm">
                                  <div className="space-y-1">
                                    <p className="flex items-center gap-2"><Zap className="w-3 h-3" /> Électricité : {exhibitor.detailedInfo.needsElectricity ? "OUI" : "NON"}</p>
                                    <p className="flex items-center gap-2"><Utensils className="w-3 h-3" /> Repas Dimanche : {exhibitor.detailedInfo.sundayLunchCount}</p>
                                  </div>
                                  <div className="space-y-1">
                                    <p className="flex items-center gap-2"><Ticket className="w-3 h-3" /> Lot Tombola : {exhibitor.detailedInfo.tombolaLot ? "OUI" : "NON"}</p>
                                    {exhibitor.detailedInfo.tombolaLotDescription && (
                                      <p className="text-xs text-muted-foreground ml-5">{exhibitor.detailedInfo.tombolaLotDescription}</p>
                                    )}
                                  </div>
                                </div>
                                <div className="text-xs pt-2 border-t space-y-1">
                                  <p><strong>Assurance :</strong> {exhibitor.detailedInfo.insuranceCompany} ({exhibitor.detailedInfo.insurancePolicyNumber})</p>
                                  <p><strong>Accords :</strong> Droit image : {exhibitor.detailedInfo.agreedToImageRights ? "OK" : "-"} | Règlement : {exhibitor.detailedInfo.agreedToTerms ? "OK" : "-"}</p>
                                </div>
                              </div>
                            )}
                          </div>

                          <DialogFooter className="gap-2">
                            {exhibitor.status === 'pending' && (
                              <>
                                <Dialog>
                                  <DialogTrigger asChild>
                                    <Button variant="destructive" className="gap-2">
                                      <XCircle className="w-4 h-4" /> Refuser
                                    </Button>
                                  </DialogTrigger>
                                  <DialogContent>
                                    <DialogHeader>
                                      <DialogTitle>Motif du refus</DialogTitle>
                                      <DialogDescription>Générer un message poli avec l'IA et envoyer l'e-mail.</DialogDescription>
                                    </DialogHeader>
                                    <div className="space-y-4 py-4">
                                      <Button 
                                        onClick={() => handleGenerateRejectIA(exhibitor, ["Trop d'articles similaires", "Non artisanal", "Plus de place disponible"])}
                                        disabled={isGenerating}
                                        variant="outline"
                                        className="w-full"
                                      >
                                        {isGenerating ? <Loader2 className="w-4 h-4 animate-spin" /> : "Générer Justification IA"}
                                      </Button>
                                      <Textarea 
                                        placeholder="Saisissez ici le motif du refus qui sera envoyé au candidat..."
                                        value={justification} 
                                        onChange={(e) => setJustification(e.target.value)} 
                                        className="min-h-[200px]"
                                      />
                                      <div className="p-3 bg-muted/50 rounded-lg flex items-start gap-2 text-xs">
                                        <Mail className="w-4 h-4 shrink-0 mt-0.5 text-primary" />
                                        <p>Une copie de l'e-mail de refus envoyé à <strong>{exhibitor.email}</strong> vous sera adressée en copie (CC).</p>
                                      </div>
                                    </div>
                                    <DialogFooter>
                                      <Button 
                                        variant="destructive" 
                                        disabled={isSending || !justification}
                                        onClick={() => handleConfirmReject(exhibitor)}
                                        className="gap-2"
                                      >
                                        {isSending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Mail className="w-4 h-4" />}
                                        Confirmer et Envoyer le Refus
                                      </Button>
                                    </DialogFooter>
                                  </DialogContent>
                                </Dialog>

                                <Dialog>
                                  <DialogTrigger asChild>
                                    <Button className="bg-secondary hover:bg-secondary/90 text-white gap-2 border-none">
                                      <CheckCircle className="w-4 h-4" /> Accepter & Envoyer Form. 2
                                    </Button>
                                  </DialogTrigger>
                                  <DialogContent>
                                    <DialogHeader>
                                      <DialogTitle>Validation de la candidature</DialogTitle>
                                      <DialogDescription>
                                        Le candidat recevra un e-mail avec son lien unique pour le dossier technique.
                                      </DialogDescription>
                                    </DialogHeader>
                                    <div className="space-y-4 py-4">
                                      <div className="space-y-2">
                                        <h4 className="text-sm font-bold">Message personnalisé (optionnel) :</h4>
                                        <Textarea 
                                          placeholder="Ex: Nous avons particulièrement aimé vos créations en bois. Merci de noter que l'emplacement sera situé près de l'entrée..."
                                          value={acceptanceMessage}
                                          onChange={(e) => setAcceptanceMessage(e.target.value)}
                                          className="min-h-[120px]"
                                        />
                                      </div>
                                      <div className="p-3 bg-muted/50 rounded-lg flex items-start gap-2 text-xs">
                                        <Mail className="w-4 h-4 shrink-0 mt-0.5 text-primary" />
                                        <p>Une copie de l'e-mail envoyé à <strong>{exhibitor.email}</strong> vous sera adressée en copie conforme (CC).</p>
                                      </div>
                                    </div>
                                    <DialogFooter>
                                      <Button 
                                        disabled={isSending}
                                        onClick={() => handleAcceptAndSend(exhibitor)}
                                        className="bg-secondary hover:bg-secondary/90 text-white gap-2"
                                      >
                                        {isSending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Mail className="w-4 h-4" />}
                                        Confirmer et Envoyer l'E-mail
                                      </Button>
                                    </DialogFooter>
                                  </DialogContent>
                                </Dialog>
                              </>
                            )}
                            {exhibitor.status === 'submitted_form2' && (
                              <Button 
                                className="bg-accent hover:bg-accent/90 text-accent-foreground gap-2 border-none"
                                onClick={() => updateStatus(exhibitor.id, 'validated')}
                              >
                                <UserCheck className="w-4 h-4" /> Valider Inscription Finale
                              </Button>
                            )}
                          </DialogFooter>
                        </DialogContent>
                      </Dialog>

                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button variant="outline" size="sm" className="text-destructive hover:bg-destructive hover:text-white border-destructive/20">
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>Supprimer cette candidature ?</AlertDialogTitle>
                            <AlertDialogDescription>
                              Cette action est irréversible. Toutes les données liées à l'exposant <strong>{exhibitor.companyName}</strong> seront définitivement supprimées.
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>Annuler</AlertDialogCancel>
                            <AlertDialogAction onClick={() => handleDelete(exhibitor.id)} className="bg-destructive hover:bg-destructive/90 text-white">
                              Supprimer définitivement
                            </AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
              {filteredExhibitors.length === 0 && (
                <TableRow>
                  <TableCell colSpan={5} className="text-center py-10 text-muted-foreground">
                    Aucune candidature trouvée.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </Card>

        <div className="text-center py-6">
          <p className="flex items-center justify-center gap-2 text-secondary font-bold text-sm uppercase tracking-wider">
            <Heart className="w-4 h-4 fill-secondary" /> Soutien à l'association "Un jardin pour Félix"
          </p>
        </div>
      </main>
    </div>
  );
}
