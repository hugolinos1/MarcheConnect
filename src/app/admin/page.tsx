"use client"
import React, { useEffect, useState } from 'react';
import { Exhibitor, ApplicationStatus } from '@/lib/types';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { ChristmasSnow } from '@/components/ChristmasSnow';
import { LayoutDashboard, CheckCircle, XCircle, FileText, Search, UserCheck, Globe, MapPin, Ticket, Zap, Utensils, Star, Heart } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { generateRejectionJustification } from '@/ai/flows/generate-rejection-justification';
import { Textarea } from '@/components/ui/textarea';
import Link from 'next/link';
import Image from 'next/image';

export default function AdminDashboard() {
  const [exhibitors, setExhibitors] = useState<Exhibitor[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [justification, setJustification] = useState('');
  const [selectedExhibitor, setSelectedExhibitor] = useState<Exhibitor | null>(null);

  useEffect(() => {
    const data = JSON.parse(localStorage.getItem('exhibitors') || '[]');
    setExhibitors(data);
  }, []);

  const updateStatus = (id: string, status: ApplicationStatus, additionalData = {}) => {
    const updated = exhibitors.map(e => e.id === id ? { ...e, status, ...additionalData } : e);
    setExhibitors(updated);
    localStorage.setItem('exhibitors', JSON.stringify(updated));
  };

  const handleReject = async (exhibitor: Exhibitor, reasons: string[]) => {
    setIsGenerating(true);
    try {
      const result = await generateRejectionJustification({
        applicantName: exhibitor.name,
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
    e.name.toLowerCase().includes(searchTerm.toLowerCase())
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
            <div className="relative w-12 h-12 brightness-0 invert">
              <Image 
                src="https://picsum.photos/seed/felix-logo/200/200"
                alt="Logo"
                fill
                className="object-contain"
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
                <TableHead>Origine</TableHead>
                <TableHead>Tables</TableHead>
                <TableHead>Statut</TableHead>
                <TableHead className="text-right">Détails</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredExhibitors.map((exhibitor) => (
                <TableRow key={exhibitor.id} className="hover:bg-muted/30">
                  <TableCell>
                    <div className="font-semibold">{exhibitor.companyName}</div>
                    <div className="text-xs text-muted-foreground">{exhibitor.name}</div>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-1 text-xs">
                      <MapPin className="w-3 h-3 text-muted-foreground" />
                      {exhibitor.origin}
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
                          {/* Étude Initiale */}
                          <div className="grid grid-cols-2 gap-4">
                            <div className="p-3 bg-muted/50 rounded-lg space-y-2">
                              <h4 className="text-xs font-bold uppercase text-muted-foreground">Profil</h4>
                              <p className="text-sm"><strong>Contact :</strong> {exhibitor.name}</p>
                              <p className="text-sm"><strong>Email :</strong> {exhibitor.email}</p>
                              <p className="text-sm"><strong>Tel :</strong> {exhibitor.phone}</p>
                              <p className="text-sm flex items-center gap-1"><strong>Statut :</strong> {exhibitor.isRegistered ? 'Déclaré' : 'Particulier'}</p>
                            </div>
                            <div className="p-3 bg-muted/50 rounded-lg space-y-2">
                              <h4 className="text-xs font-bold uppercase text-muted-foreground">Logistique Demandée</h4>
                              <p className="text-sm"><strong>Tables :</strong> {exhibitor.requestedTables}</p>
                              <p className="text-sm"><strong>Origine :</strong> {exhibitor.origin}</p>
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

                          <div className="p-4 bg-primary/5 border border-primary/20 rounded-lg">
                            <h4 className="font-bold text-primary mb-2">Description / Nature du stand :</h4>
                            <p className="text-sm italic">{exhibitor.productDescription}</p>
                          </div>

                          {/* Dossier Final (si reçu) */}
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
                                    <DialogDescription>Générer un message poli avec l'IA.</DialogDescription>
                                  </DialogHeader>
                                  <div className="space-y-4 py-4">
                                    <Button 
                                      onClick={() => handleReject(exhibitor, ["Trop d'articles similaires", "Non artisanal", "Plus de place disponible"])}
                                      disabled={isGenerating}
                                      variant="outline"
                                      className="w-full"
                                    >
                                      {isGenerating ? "Génération..." : "Générer Justification IA"}
                                    </Button>
                                    <Textarea 
                                      value={justification} 
                                      onChange={(e) => setJustification(e.target.value)} 
                                      className="min-h-[200px]"
                                    />
                                  </div>
                                  <DialogFooter>
                                    <Button 
                                      variant="destructive" 
                                      onClick={() => {
                                        updateStatus(exhibitor.id, 'rejected', { rejectionJustification: justification });
                                        setJustification('');
                                      }}
                                    >
                                      Confirmer Refus
                                    </Button>
                                  </DialogFooter>
                                </DialogContent>
                              </Dialog>
                              <Button 
                                className="bg-secondary hover:bg-secondary/90 text-white gap-2 border-none"
                                onClick={() => updateStatus(exhibitor.id, 'accepted_form1')}
                              >
                                <CheckCircle className="w-4 h-4" /> Accepter & Envoyer Form. 2
                              </Button>
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

        {/* Footer info solidatité */}
        <div className="text-center py-6">
          <p className="flex items-center justify-center gap-2 text-secondary font-bold text-sm uppercase tracking-wider">
            <Heart className="w-4 h-4 fill-secondary" /> Soutien à l'association "Un jardin pour Félix"
          </p>
        </div>
      </main>
    </div>
  );
}