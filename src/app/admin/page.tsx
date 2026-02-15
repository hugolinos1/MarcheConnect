
"use client"
import React, { useEffect, useState } from 'react';
import { Exhibitor, ApplicationStatus } from '@/lib/types';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { ChristmasSnow } from '@/components/ChristmasSnow';
import { TreePine, LayoutDashboard, CheckCircle, XCircle, FileText, Search, UserCheck } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { generateRejectionJustification } from '@/ai/flows/generate-rejection-justification';
import { Textarea } from '@/components/ui/textarea';
import Link from 'next/link';

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
    accepted: exhibitors.filter(e => e.status === 'accepted_form1' || e.status === 'submitted_form2' || e.status === 'validated').length,
    validated: exhibitors.filter(e => e.status === 'validated').length,
  };

  return (
    <div className="min-h-screen bg-background">
      <ChristmasSnow />
      
      {/* Sidebar-like Header */}
      <div className="bg-primary text-white py-6 shadow-lg relative z-10">
        <div className="container mx-auto px-4 flex justify-between items-center">
          <div className="flex items-center gap-3">
            <LayoutDashboard className="w-8 h-8" />
            <div>
              <h1 className="text-2xl font-headline font-bold">MarchéConnect Admin</h1>
              <p className="text-sm opacity-80">Gestion des candidatures 2024</p>
            </div>
          </div>
          <div className="flex gap-4">
            <Button asChild variant="secondary" size="sm">
              <Link href="/">Voir le site</Link>
            </Button>
          </div>
        </div>
      </div>

      <main className="container mx-auto px-4 py-10 relative z-10 space-y-8">
        {/* Stats Grid */}
        <div className="grid md:grid-cols-3 gap-6">
          <Card className="bg-white/80 backdrop-blur">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground uppercase">En attente</CardTitle>
              <Search className="w-4 h-4 text-primary" />
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-primary">{stats.pending}</div>
            </CardContent>
          </Card>
          <Card className="bg-white/80 backdrop-blur">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground uppercase">Acceptés</CardTitle>
              <CheckCircle className="w-4 h-4 text-secondary" />
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-secondary">{stats.accepted}</div>
            </CardContent>
          </Card>
          <Card className="bg-white/80 backdrop-blur">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground uppercase">Validés Final</CardTitle>
              <UserCheck className="w-4 h-4 text-accent" />
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-accent">{stats.validated}</div>
            </CardContent>
          </Card>
        </div>

        {/* Search & Actions */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div className="relative w-full md:w-96">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input 
              placeholder="Rechercher un exposant..." 
              className="pl-10"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
        </div>

        {/* Applications Table */}
        <Card className="overflow-hidden">
          <Table>
            <TableHeader className="bg-muted/50">
              <TableRow>
                <TableHead>Exposant</TableHead>
                <TableHead>Entreprise</TableHead>
                <TableHead>Statut</TableHead>
                <TableHead>Date</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredExhibitors.map((exhibitor) => (
                <TableRow key={exhibitor.id} className="hover:bg-muted/30">
                  <TableCell>
                    <div className="font-semibold">{exhibitor.name}</div>
                    <div className="text-xs text-muted-foreground">{exhibitor.email}</div>
                  </TableCell>
                  <TableCell>{exhibitor.companyName}</TableCell>
                  <TableCell>
                    {exhibitor.status === 'pending' && <Badge variant="secondary">En attente</Badge>}
                    {exhibitor.status === 'accepted_form1' && <Badge className="bg-blue-100 text-blue-800 hover:bg-blue-100">Form 2 envoyé</Badge>}
                    {exhibitor.status === 'submitted_form2' && <Badge className="bg-orange-100 text-orange-800 hover:bg-orange-100">Dossier reçu</Badge>}
                    {exhibitor.status === 'validated' && <Badge className="bg-green-100 text-green-800 hover:bg-green-100">Validé</Badge>}
                    {exhibitor.status === 'rejected' && <Badge variant="destructive">Refusé</Badge>}
                  </TableCell>
                  <TableCell className="text-xs">{new Date(exhibitor.createdAt).toLocaleDateString()}</TableCell>
                  <TableCell className="text-right space-x-2">
                    <Dialog>
                      <DialogTrigger asChild>
                        <Button variant="outline" size="sm" onClick={() => setSelectedExhibitor(exhibitor)}>
                          <FileText className="w-4 h-4 mr-1" /> Dossier
                        </Button>
                      </DialogTrigger>
                      <DialogContent className="max-w-2xl">
                        <DialogHeader>
                          <DialogTitle>Détails de la candidature</DialogTitle>
                          <DialogDescription>
                            Entreprise : {exhibitor.companyName}
                          </DialogDescription>
                        </DialogHeader>
                        <div className="space-y-4 py-4">
                          <div className="p-4 bg-muted rounded-lg">
                            <h4 className="font-semibold mb-2">Description des produits :</h4>
                            <p className="text-sm whitespace-pre-wrap">{exhibitor.productDescription}</p>
                          </div>
                          {exhibitor.status === 'submitted_form2' && exhibitor.detailedInfo && (
                            <div className="p-4 border-2 border-secondary/20 rounded-lg">
                              <h4 className="font-semibold mb-2 text-secondary">Informations complémentaires :</h4>
                              <ul className="text-sm space-y-1">
                                <li><strong>Stand :</strong> {exhibitor.detailedInfo.boothSize}</li>
                                <li><strong>Electricité :</strong> {exhibitor.detailedInfo.needsElectricity ? `Oui (${exhibitor.detailedInfo.electricityPower})` : 'Non'}</li>
                                <li><strong>Assurance :</strong> {exhibitor.detailedInfo.insuranceCompany} ({exhibitor.detailedInfo.insurancePolicyNumber})</li>
                              </ul>
                            </div>
                          )}
                        </div>
                        <DialogFooter className="flex-col sm:flex-row gap-2">
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
                                    <DialogTitle>Justification du refus</DialogTitle>
                                    <DialogDescription>Utilisez l'IA pour générer un message poli.</DialogDescription>
                                  </DialogHeader>
                                  <div className="space-y-4 py-4">
                                    <Button 
                                      onClick={() => handleReject(exhibitor, ["Manque de place", "Catégorie déjà saturée"])}
                                      disabled={isGenerating}
                                      variant="outline"
                                      className="w-full"
                                    >
                                      {isGenerating ? "Génération..." : "Générer avec l'IA"}
                                    </Button>
                                    <Textarea 
                                      value={justification} 
                                      onChange={(e) => setJustification(e.target.value)} 
                                      placeholder="Le message s'affichera ici..."
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
                                      Confirmer le refus
                                    </Button>
                                  </DialogFooter>
                                </DialogContent>
                              </Dialog>
                              <Button 
                                className="bg-secondary hover:bg-secondary/90 text-white gap-2"
                                onClick={() => updateStatus(exhibitor.id, 'accepted_form1')}
                              >
                                <CheckCircle className="w-4 h-4" /> Accepter Étape 1
                              </Button>
                            </>
                          )}
                          {exhibitor.status === 'submitted_form2' && (
                            <Button 
                              className="bg-accent hover:bg-accent/90 text-accent-foreground gap-2"
                              onClick={() => updateStatus(exhibitor.id, 'validated')}
                            >
                              <UserCheck className="w-4 h-4" /> Valider Définitivement
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

        {/* Section Debug (Mock simulation for testing Flow 1 -> Flow 2) */}
        {exhibitors.some(e => e.status === 'accepted_form1') && (
          <div className="mt-12 p-6 bg-accent/10 border border-accent rounded-xl space-y-4">
            <h3 className="font-headline font-bold text-accent-foreground flex items-center gap-2">
              <Star className="w-5 h-5 fill-accent" /> Mode Test (Simulation email)
            </h3>
            <p className="text-sm">En conditions réelles, un email contenant ce lien est envoyé à l'exposant :</p>
            <div className="flex flex-wrap gap-4">
              {exhibitors.filter(e => e.status === 'accepted_form1').map(e => (
                <Button key={e.id} asChild variant="secondary" size="sm" className="bg-white">
                  <Link href={`/details/${e.id}`}>Lien Formulaire 2 pour {e.companyName}</Link>
                </Button>
              ))}
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
