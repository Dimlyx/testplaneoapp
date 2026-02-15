import { jsPDF } from "jspdf";
import { Intervention } from "@/hooks/useInterventions";
import { format } from "date-fns";
import { fr } from "date-fns/locale";

interface Client {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  address: string | null;
  city: string | null;
  postal_code: string | null;
  client_type: 'individual' | 'professional';
  notes: string | null;
  organization_id?: string | null;
  created_at: string;
  updated_at: string;
}

interface InterventionPhoto {
  id: string;
  photo_url: string;
  photo_type: 'serial_number' | 'during' | 'after';
  equipment_id?: string | null;
}

type EquipmentStatus = 'not_working' | 'needs_intervention' | 'working';

interface InterventionEquipmentData {
  id: string;
  equipment_id: string;
  technical_comments: string | null;
  equipment_functional: boolean | null;
  equipment_status: EquipmentStatus | null;
  equipment?: {
    id: string;
    brand: string;
    model: string;
    equipment_type: string;
    serial_number: string | null;
  };
}

interface PDFGeneratorOptions {
  intervention: Intervention;
  client: Client;
  technicianName?: string;
  photos?: InterventionPhoto[];
  interventionEquipments?: InterventionEquipmentData[];
}

interface CompanySettings {
  name: string;
  legalName: string;
  siret: string;
  tvaNumber: string;
  rcsNumber: string;
  capitalSocial: string;
  address: string;
  postalCode: string;
  city: string;
  phone: string;
  email: string;
  website: string;
  logoUrl: string;
}

interface ReportSettings {
  primaryColor: string;
  accentColor: string;
  footerText: string;
}

interface DocumentSettings {
  showClientInfo: boolean;
  showInterventionAddress: boolean;
  showScheduledDateTime: boolean;
  showDescription: boolean;
  showEquipmentDetails: boolean;
  showEquipmentPhotos: boolean;
  showWorkflowSteps: boolean;
  primaryColor: string;
  accentColor: string;
  footerText: string;
  welcomeMessage: string;
}

interface PDFSettings {
  company: CompanySettings;
  report: ReportSettings;
  documents?: DocumentSettings;
}

const DEFAULT_COMPANY: CompanySettings = {
  name: '',
  legalName: '',
  siret: '',
  tvaNumber: '',
  rcsNumber: '',
  capitalSocial: '',
  address: '',
  postalCode: '',
  city: '',
  phone: '',
  email: '',
  website: '',
  logoUrl: '',
};

const DEFAULT_REPORT: ReportSettings = {
  primaryColor: '#003057',
  accentColor: '#0050A0',
  footerText: '',
};

const hexToRgb = (hex: string): [number, number, number] => {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  return result 
    ? [parseInt(result[1], 16), parseInt(result[2], 16), parseInt(result[3], 16)]
    : [0, 48, 87]; // Default navy blue
};

const MAX_IMAGE_WIDTH = 400;
const MAX_IMAGE_HEIGHT = 300;
const JPEG_QUALITY = 0.6;

const loadImageAsBase64 = async (url: string): Promise<string | null> => {
  try {
    // Use fetch to avoid CORS canvas tainting issues
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10000);
    
    const response = await fetch(url, { signal: controller.signal });
    clearTimeout(timeout);
    
    if (!response.ok) {
      console.warn('Failed to fetch image:', url, response.status);
      return null;
    }
    
    const blob = await response.blob();
    
    // Convert blob to base64 via FileReader
    const base64 = await new Promise<string | null>((resolve) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result as string);
      reader.onerror = () => resolve(null);
      reader.readAsDataURL(blob);
    });
    
    if (!base64) return null;
    
    // Resize using canvas (no CORS issue since we loaded via fetch)
    return new Promise((resolve) => {
      const img = new Image();
      img.onload = () => {
        try {
          let width = img.naturalWidth;
          let height = img.naturalHeight;
          
          if (width > MAX_IMAGE_WIDTH) {
            height = (height * MAX_IMAGE_WIDTH) / width;
            width = MAX_IMAGE_WIDTH;
          }
          if (height > MAX_IMAGE_HEIGHT) {
            width = (width * MAX_IMAGE_HEIGHT) / height;
            height = MAX_IMAGE_HEIGHT;
          }
          
          const canvas = document.createElement('canvas');
          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext('2d');
          
          if (ctx) {
            ctx.imageSmoothingEnabled = true;
            ctx.imageSmoothingQuality = 'medium';
            ctx.drawImage(img, 0, 0, width, height);
            resolve(canvas.toDataURL('image/jpeg', JPEG_QUALITY));
          } else {
            resolve(base64);
          }
        } catch (err) {
          console.error('Error resizing image:', err);
          resolve(base64);
        }
      };
      img.onerror = () => resolve(base64);
      img.src = base64;
    });
  } catch (err) {
    console.error('Error loading image:', url, err);
    return null;
  }
};

interface StepCompletionData {
  step_id: string;
  comment: string | null;
  photo_url: string | null;
  completed_at: string | null;
}

interface WorkflowStepData {
  id: string;
  label: string;
  requires_photo: boolean | null;
  requires_comment: boolean | null;
}

const parsePhotoUrls = (photoUrl: string | null): string[] => {
  if (!photoUrl) return [];
  try {
    const parsed = JSON.parse(photoUrl);
    if (Array.isArray(parsed)) return parsed;
  } catch {}
  return photoUrl ? [photoUrl] : [];
};

export const generateInterventionPDF = async (
  intervention: Intervention, 
  client: Client, 
  equipment?: {
    id: string;
    brand: string;
    model: string;
    equipment_type: string;
    serial_number: string | null;
    installation_date?: string | null;
    organization_id?: string | null;
  } | null,
  technicianName?: string,
  photos?: InterventionPhoto[],
  interventionEquipments?: InterventionEquipmentData[],
  pdfSettings?: PDFSettings,
  stepCompletions?: StepCompletionData[],
  workflowSteps?: WorkflowStepData[]
) => {
  const doc = new jsPDF();
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  let yPos = 20;
  
  // Use provided settings or defaults
  const company = pdfSettings?.company || DEFAULT_COMPANY;
  const report = pdfSettings?.report || DEFAULT_REPORT;
  const docSettings = pdfSettings?.documents;
  const primaryRgb = hexToRgb(docSettings?.primaryColor || report.primaryColor);
  const accentRgb = hexToRgb(docSettings?.accentColor || report.accentColor);
  const footerText = docSettings?.footerText ?? report.footerText;
  
  // Helper functions
  const centerText = (text: string, y: number, fontSize: number = 12) => {
    doc.setFontSize(fontSize);
    const textWidth = doc.getTextWidth(text);
    doc.text(text, (pageWidth - textWidth) / 2, y);
  };
  
  const addSection = (title: string, y: number, useAccent: boolean = false) => {
    doc.setFontSize(11);
    doc.setFont("helvetica", "bold");
    if (useAccent) {
      doc.setFillColor(accentRgb[0], accentRgb[1], accentRgb[2]);
      doc.setTextColor(255, 255, 255);
    } else {
      doc.setFillColor(240, 240, 240);
      doc.setTextColor(0, 0, 0);
    }
    doc.rect(10, y - 5, pageWidth - 20, 8, 'F');
    doc.text(title, 15, y);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(0, 0, 0);
    return y + 10;
  };
  
  const addField = (label: string, value: string, y: number, x: number = 15) => {
    doc.setFontSize(9);
    doc.setFont("helvetica", "bold");
    doc.text(label + ":", x, y);
    doc.setFont("helvetica", "normal");
    doc.text(value || "N/C", x + doc.getTextWidth(label + ": "), y);
    return y + 6;
  };

  const checkNewPage = (neededHeight: number) => {
    if (yPos + neededHeight > pageHeight - 20) {
      doc.addPage();
      yPos = 20;
      return true;
    }
    return false;
  };

  // ================== HEADER ==================
  const headerHeight = 45;
  doc.setFillColor(primaryRgb[0], primaryRgb[1], primaryRgb[2]);
  doc.rect(0, 0, pageWidth, headerHeight, 'F');
  
  doc.setTextColor(255, 255, 255);
  
  let logoWidth = 0;
  const logoMargin = 15;
  
  // Add logo if available
  if (company.logoUrl) {
    try {
      const logoBase64 = await loadImageAsBase64(company.logoUrl);
      if (logoBase64) {
        const logoHeight = 25;
        logoWidth = 30;
        doc.addImage(logoBase64, 'JPEG', logoMargin, 10, logoWidth, logoHeight);
        logoWidth += 10; // Add spacing after logo
      }
    } catch (err) {
      console.error('Error loading logo:', err);
    }
  }
  
  const textStartX = logoMargin + logoWidth;
  
  doc.setFontSize(18);
  doc.setFont("helvetica", "bold");
  
  // Company name or default title
  if (company.name) {
    doc.setFontSize(12);
    doc.text(company.name, textStartX, 15);
    doc.setFontSize(14);
    doc.text("RAPPORT D'INTERVENTION", textStartX, 25);
  } else {
    doc.setFontSize(16);
    doc.text("RAPPORT D'INTERVENTION", textStartX, 20);
  }
  
  doc.setFontSize(10);
  doc.setFont("helvetica", "normal");
  doc.text(client.name, textStartX, 35);
  
  // Company contact info in header (right aligned)
  if (company.phone || company.email) {
    doc.setFontSize(8);
    const contactInfo = [company.phone, company.email].filter(Boolean).join(' | ');
    const contactWidth = doc.getTextWidth(contactInfo);
    doc.text(contactInfo, pageWidth - contactWidth - 15, 40);
  }
  
  doc.setTextColor(0, 0, 0);
  yPos = headerHeight + 10;

  // Reference & Date
  doc.setFontSize(10);
  doc.setFont("helvetica", "bold");
  doc.text(`Référence : INT-${intervention.id.slice(0, 8).toUpperCase()}`, 15, yPos);
  doc.text(`Date : ${intervention.scheduled_date ? format(new Date(intervention.scheduled_date), 'dd/MM/yyyy', { locale: fr }) : format(new Date(), 'dd/MM/yyyy', { locale: fr })}`, pageWidth - 60, yPos);
  yPos += 15;

  // ================== CLIENT SECTION ==================
  if (!docSettings || docSettings.showClientInfo) {
    yPos = addSection("INFORMATIONS CLIENT", yPos);
    yPos = addField("Client", client.name, yPos);
    yPos = addField("Type", client.client_type === 'individual' ? 'Particulier' : 'Professionnel', yPos);
    if (client.phone) yPos = addField("Téléphone", client.phone, yPos);
    if (client.email) yPos = addField("Email", client.email, yPos);
    const fullAddress = [client.address, client.postal_code, client.city].filter(Boolean).join(', ');
    if (fullAddress) yPos = addField("Adresse chantier", fullAddress, yPos);
    yPos += 5;
  }

  // ================== LIEU D'INTERVENTION (si différent) ==================
  if (!docSettings || docSettings.showInterventionAddress) {
    const hasInterventionContact = intervention.intervention_address || intervention.intervention_phone || intervention.intervention_email;
    if (hasInterventionContact) {
      yPos = addSection("LIEU D'INTERVENTION", yPos);
      const interventionFullAddress = [intervention.intervention_address, intervention.intervention_postal_code, intervention.intervention_city].filter(Boolean).join(', ');
      if (interventionFullAddress) yPos = addField("Adresse", interventionFullAddress, yPos);
      const buildingFloor = [(intervention as any).intervention_building, (intervention as any).intervention_floor].filter(Boolean).join(' - ');
      if (buildingFloor) yPos = addField("Bâtiment / Étage", buildingFloor, yPos);
      if (intervention.intervention_phone) yPos = addField("Téléphone", intervention.intervention_phone, yPos);
      if (intervention.intervention_email) yPos = addField("Email", intervention.intervention_email, yPos);
      yPos += 5;
    }
  }

  // ================== INTERVENTION DETAILS ==================
  yPos = addSection("DÉTAILS DE L'INTERVENTION", yPos);
  yPos = addField("Titre", intervention.title, yPos);
  yPos = addField("Type", intervention.intervention_type, yPos);
  if (technicianName) {
    yPos = addField("Technicien", technicianName, yPos);
  }
  if ((!docSettings || docSettings.showScheduledDateTime) && intervention.scheduled_date) {
    yPos = addField("Date prévue", format(new Date(intervention.scheduled_date), 'dd/MM/yyyy', { locale: fr }), yPos);
  }
  if ((!docSettings || docSettings.showDescription) && intervention.description) {
    yPos += 2;
    doc.setFontSize(9);
    const descLines = doc.splitTextToSize(intervention.description, pageWidth - 30);
    doc.text(descLines, 15, yPos);
    yPos += descLines.length * 5;
  }
  yPos += 5;


  // ================== EQUIPMENTS SECTION ==================
  if ((!docSettings || docSettings.showEquipmentDetails) && interventionEquipments && interventionEquipments.length > 0) {
    for (let i = 0; i < interventionEquipments.length; i++) {
      const eq = interventionEquipments[i];
      const eqInfo = eq.equipment;
      const eqPhotos = photos?.filter(p => p.equipment_id === eq.equipment_id) || [];
      
      checkNewPage(80);
      
      // Equipment header with accent color
      // Build equipment header - exclude "À identifier" values
      const brandDisplay = eqInfo?.brand && eqInfo.brand !== 'À identifier' ? eqInfo.brand : '';
      const modelDisplay = eqInfo?.model && eqInfo.model !== 'À identifier' ? eqInfo.model : '';
      const headerLabel = [brandDisplay, modelDisplay].filter(Boolean).join(' ') || eqInfo?.equipment_type || '';
      
      yPos = addSection(`ÉQUIPEMENT ${i + 1}: ${headerLabel}`, yPos, true);
      doc.setTextColor(0, 0, 0);
      
      // Equipment details - exclude "À identifier" values
      if (eqInfo) {
        yPos = addField("Type", eqInfo.equipment_type, yPos);
        if (eqInfo.brand && eqInfo.brand !== 'À identifier') {
          yPos = addField("Marque", eqInfo.brand, yPos);
        }
        if (eqInfo.model && eqInfo.model !== 'À identifier') {
          yPos = addField("Modèle", eqInfo.model, yPos);
        }
        if (eqInfo.serial_number) yPos = addField("N° Série", eqInfo.serial_number, yPos);
      }
      yPos += 3;

      // Photos S/N
      const showPhotos = !docSettings || docSettings.showEquipmentPhotos;
      const snPhotos = eqPhotos.filter(p => p.photo_type === 'serial_number');
      if (showPhotos && snPhotos.length > 0) {
        checkNewPage(60);
        doc.setFontSize(10);
        doc.setFont("helvetica", "bold");
        doc.text("Photos N° de série", 15, yPos);
        doc.setFont("helvetica", "normal");
        yPos += 5;
        
        for (const photo of snPhotos) {
          const base64 = await loadImageAsBase64(photo.photo_url);
          if (base64) {
            checkNewPage(50);
            try {
              doc.addImage(base64, 'JPEG', 15, yPos, 60, 45);
              yPos += 50;
            } catch (e) {
              console.error('Error adding SN photo:', e);
            }
          }
        }
      }

      // Photo de l'équipement (during photos)
      const duringPhotos = eqPhotos.filter(p => p.photo_type === 'during');
      if (showPhotos && duringPhotos.length > 0) {
        checkNewPage(60);
        doc.setFontSize(10);
        doc.setFont("helvetica", "bold");
        doc.text("Photo de l'équipement", 15, yPos);
        doc.setFont("helvetica", "normal");
        yPos += 5;
        
        let xPos = 15;
        let photoCount = 0;
        for (const photo of duringPhotos) {
          const base64 = await loadImageAsBase64(photo.photo_url);
          if (base64) {
            if (photoCount > 0 && photoCount % 2 === 0) {
              xPos = 15;
              yPos += 50;
              checkNewPage(50);
            }
            try {
              doc.addImage(base64, 'JPEG', xPos, yPos, 60, 45);
              xPos += 70;
              photoCount++;
            } catch (e) {
              console.error('Error adding during photo:', e);
            }
          }
        }
        if (photoCount > 0) yPos += 50;
      }

      // Technical comments / Observation
      if (eq.technical_comments) {
        checkNewPage(30);
        doc.setFontSize(10);
        doc.setFont("helvetica", "bold");
        doc.text("Observation", 15, yPos);
        doc.setFont("helvetica", "normal");
        yPos += 5;
        doc.setFontSize(9);
        const commentLines = doc.splitTextToSize(eq.technical_comments, pageWidth - 30);
        doc.text(commentLines, 15, yPos);
        yPos += commentLines.length * 5 + 5;
      }

      // État de l'équipement
      checkNewPage(20);
      doc.setFontSize(10);
      doc.setFont("helvetica", "bold");
      doc.text("État de l'équipement", 15, yPos);
      doc.setFont("helvetica", "normal");
      yPos += 5;
      doc.setFontSize(9);
      const getEquipmentStatusLabel = (status: EquipmentStatus | null) => {
        switch (status) {
          case 'not_working': return 'Ne fonctionne pas';
          case 'needs_intervention': return 'Fonctionne - Pièces ou intervention nécessaire';
          case 'working': return 'Fonctionne';
          default: return 'Non renseigné';
        }
      };
      doc.text(`État: ${getEquipmentStatusLabel(eq.equipment_status)}`, 15, yPos);
      yPos += 8;

      // Photos après (after photos)
      const afterPhotos = eqPhotos.filter(p => p.photo_type === 'after');
      if (showPhotos && afterPhotos.length > 0) {
        checkNewPage(60);
        doc.setFontSize(10);
        doc.setFont("helvetica", "bold");
        doc.text("Photos après intervention", 15, yPos);
        doc.setFont("helvetica", "normal");
        yPos += 5;
        
        let xPos = 15;
        let photoCount = 0;
        for (const photo of afterPhotos) {
          const base64 = await loadImageAsBase64(photo.photo_url);
          if (base64) {
            if (photoCount > 0 && photoCount % 2 === 0) {
              xPos = 15;
              yPos += 50;
              checkNewPage(50);
            }
            try {
              doc.addImage(base64, 'JPEG', xPos, yPos, 60, 45);
              xPos += 70;
              photoCount++;
            } catch (e) {
              console.error('Error adding after photo:', e);
            }
          }
        }
        if (photoCount > 0) yPos += 55;
      }
      
      yPos += 5;
    }
  } else if (equipment) {
    // Legacy: single equipment mode
    yPos = addSection("ÉQUIPEMENT", yPos);
    yPos = addField("Type", equipment.equipment_type, yPos);
    if (equipment.brand && equipment.brand !== 'À identifier') {
      yPos = addField("Marque", equipment.brand, yPos);
    }
    if (equipment.model && equipment.model !== 'À identifier') {
      yPos = addField("Modèle", equipment.model, yPos);
    }
    if (equipment.serial_number) yPos = addField("N° Série", equipment.serial_number, yPos);
    yPos += 5;
    
    // Legacy photos
    if (photos && photos.length > 0) {
      const photoTypes = {
        serial_number: { title: "PHOTO DU NUMÉRO DE SÉRIE", photos: photos.filter(p => p.photo_type === 'serial_number') },
        during: { title: "PHOTOS PENDANT INTERVENTION", photos: photos.filter(p => p.photo_type === 'during') },
        after: { title: "PHOTOS APRÈS INTERVENTION", photos: photos.filter(p => p.photo_type === 'after') },
      };

      for (const [, { title, photos: typePhotos }] of Object.entries(photoTypes)) {
        if (typePhotos.length === 0) continue;
        
        checkNewPage(60);
        yPos = addSection(title, yPos);

        const photoWidth = 55;
        const photoHeight = 40;
        const photosPerRow = 3;
        let xPos = 15;
        let photoCount = 0;

        for (const photo of typePhotos) {
          const base64 = await loadImageAsBase64(photo.photo_url);
          
          if (base64) {
            if (photoCount > 0 && photoCount % photosPerRow === 0) {
              xPos = 15;
              yPos += photoHeight + 5;
              checkNewPage(photoHeight + 10);
            }

            try {
              doc.addImage(base64, 'JPEG', xPos, yPos, photoWidth, photoHeight);
            } catch (imgErr) {
              doc.setDrawColor(200, 200, 200);
              doc.rect(xPos, yPos, photoWidth, photoHeight);
            }
            
            xPos += photoWidth + 5;
            photoCount++;
          }
        }
        
        yPos += photoHeight + 10;
      }
    }
    
    // Equipment status
    yPos = addSection("TEST DE L'ÉQUIPEMENT", yPos);
    doc.setFontSize(9);
    const funcStatus = intervention.equipment_functional !== false ? "Oui" : "Non";
    yPos = addField("L'équipement fonctionne correctement", funcStatus, yPos);
    yPos += 10;
  }

  // ================== WORKFLOW STEPS ==================
  if ((!docSettings || docSettings.showWorkflowSteps) && workflowSteps && workflowSteps.length > 0 && stepCompletions && stepCompletions.length > 0) {
    checkNewPage(40);
    yPos = addSection("ÉTAPES DU WORKFLOW", yPos);
    
    for (const step of workflowSteps) {
      const completion = stepCompletions.find(c => c.step_id === step.id);
      if (!completion?.completed_at) continue;
      
      checkNewPage(30);
      doc.setFontSize(10);
      doc.setFont("helvetica", "bold");
      doc.text(`✓ ${step.label}`, 15, yPos);
      doc.setFont("helvetica", "normal");
      yPos += 6;
      
      if (completion.comment) {
        doc.setFontSize(9);
        const commentLines = doc.splitTextToSize(completion.comment, pageWidth - 35);
        doc.text(commentLines, 20, yPos);
        yPos += commentLines.length * 5 + 3;
      }
      
      const stepPhotoUrls = parsePhotoUrls(completion.photo_url);
      if (stepPhotoUrls.length > 0) {
        let xPos = 20;
        let photoCount = 0;
        for (const photoUrl of stepPhotoUrls) {
          const base64 = await loadImageAsBase64(photoUrl);
          if (base64) {
            if (photoCount > 0 && photoCount % 2 === 0) {
              xPos = 20;
              yPos += 50;
              checkNewPage(50);
            }
            try {
              doc.addImage(base64, 'JPEG', xPos, yPos, 55, 40);
              xPos += 65;
              photoCount++;
            } catch (e) {
              console.error('Error adding step photo:', e);
            }
          }
        }
        if (photoCount > 0) yPos += 45;
      }
      
      yPos += 3;
    }
    yPos += 5;
  }



  // ================== FOOTER ==================
  const totalPages = doc.getNumberOfPages();
  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i);
    const footerY = doc.internal.pageSize.getHeight() - 10;
    doc.setFontSize(8);
    doc.setTextColor(128, 128, 128);
    
    // Custom footer text or default
    const footerContent = footerText 
      ? `${footerText} - Page ${i}/${totalPages}`
      : `Document généré le ${format(new Date(), 'dd/MM/yyyy à HH:mm', { locale: fr })} - Page ${i}/${totalPages}`;
    
    centerText(footerContent, footerY, 8);
    
    // Add company address in footer if configured
    const fullAddress = [company.address, company.postalCode, company.city].filter(Boolean).join(', ');
    if (fullAddress) {
      doc.setFontSize(7);
      centerText(fullAddress, footerY - 5, 7);
    }
    
    // Add legal info if available
    const legalInfo = [company.siret ? `SIRET: ${company.siret}` : '', company.tvaNumber ? `TVA: ${company.tvaNumber}` : ''].filter(Boolean).join(' - ');
    if (legalInfo) {
      doc.setFontSize(6);
      centerText(legalInfo, footerY - 10, 6);
    }
  }

  // Save
  doc.save(`intervention-${intervention.id.slice(0, 8)}.pdf`);
};
