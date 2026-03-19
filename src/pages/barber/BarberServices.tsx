import { useEffect, useState, useRef, useCallback } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { BarberLayout } from '@/components/barber/BarberLayout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Plus, Pencil, Trash2, X, Check, Camera, ImageIcon, Clock, DollarSign, Video, Play } from 'lucide-react';
import { toast } from 'sonner';
import ReactCrop, { type Crop, centerCrop, makeAspectCrop } from 'react-image-crop';
import 'react-image-crop/dist/ReactCrop.css';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

interface Service {
  id: string;
  name: string;
  duration_minutes: number;
  price: number;
  is_active: boolean;
  category: string;
  image_url: string | null;
  video_url: string | null;
}

const CATEGORIES = [
  { value: 'masculino', label: '💇‍♂️ Masculino', description: 'Serviços masculinos' },
  { value: 'feminino', label: '💇‍♀️ Feminino', description: 'Serviços femininos' },
];

const MAX_VIDEO_DURATION = 20;
const MAX_VIDEO_SIZE_MB = 50;

function centerAspectCrop(mediaWidth: number, mediaHeight: number, aspect: number) {
  return centerCrop(
    makeAspectCrop({ unit: '%', width: 90 }, aspect, mediaWidth, mediaHeight),
    mediaWidth,
    mediaHeight,
  );
}

export default function BarberServices() {
  const { user } = useAuth();
  const [services, setServices] = useState<Service[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState({ name: '', duration_minutes: 30, price: 0, category: 'masculino' });
  const formRef = useRef<HTMLDivElement>(null);

  // Image crop state
  const [cropDialogOpen, setCropDialogOpen] = useState(false);
  const [imgSrc, setImgSrc] = useState('');
  const [crop, setCrop] = useState<Crop>();
  const [completedCrop, setCompletedCrop] = useState<Crop>();
  const imgRef = useRef<HTMLImageElement>(null);
  const [serviceImageUrl, setServiceImageUrl] = useState<string | null>(null);
  const [uploadingImage, setUploadingImage] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Video state
  const [serviceVideoUrl, setServiceVideoUrl] = useState<string | null>(null);
  const [uploadingVideo, setUploadingVideo] = useState(false);
  const videoInputRef = useRef<HTMLInputElement>(null);
  const [videoPreviewDialogOpen, setVideoPreviewDialogOpen] = useState(false);
  const [previewVideoUrl, setPreviewVideoUrl] = useState<string | null>(null);

  useEffect(() => {
    if (user) fetchServices();
  }, [user]);

  const fetchServices = async () => {
    if (!user) return;
    const { data } = await supabase
      .from('services')
      .select('*')
      .eq('barber_id', user.id)
      .order('category')
      .order('name');
    if (data) setServices(data as Service[]);
  };

  const onSelectFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      const reader = new FileReader();
      reader.addEventListener('load', () => {
        setImgSrc(reader.result?.toString() || '');
        setCropDialogOpen(true);
      });
      reader.readAsDataURL(e.target.files[0]);
    }
  };

  const onImageLoad = useCallback((e: React.SyntheticEvent<HTMLImageElement>) => {
    const { width, height } = e.currentTarget;
    setCrop(centerAspectCrop(width, height, 4 / 3));
  }, []);

  const getCroppedImg = async (): Promise<Blob | null> => {
    const image = imgRef.current;
    if (!image || !completedCrop) return null;

    const canvas = document.createElement('canvas');
    const scaleX = image.naturalWidth / image.width;
    const scaleY = image.naturalHeight / image.height;

    const cropX = completedCrop.x * scaleX;
    const cropY = completedCrop.y * scaleY;
    const cropWidth = completedCrop.width * scaleX;
    const cropHeight = completedCrop.height * scaleY;

    canvas.width = cropWidth;
    canvas.height = cropHeight;

    const ctx = canvas.getContext('2d');
    if (!ctx) return null;

    ctx.drawImage(image, cropX, cropY, cropWidth, cropHeight, 0, 0, cropWidth, cropHeight);

    return new Promise((resolve) => {
      canvas.toBlob((blob) => resolve(blob), 'image/jpeg', 0.9);
    });
  };

  const handleCropSave = async () => {
    if (!user) return;
    setUploadingImage(true);
    try {
      const blob = await getCroppedImg();
      if (!blob) {
        toast.error('Erro ao recortar imagem');
        return;
      }
      const fileName = `${user.id}/${Date.now()}.jpg`;
      const { error: uploadError } = await supabase.storage
        .from('service-images')
        .upload(fileName, blob, { contentType: 'image/jpeg', upsert: true });

      if (uploadError) {
        toast.error('Erro ao enviar imagem: ' + uploadError.message);
        return;
      }

      const { data: urlData } = supabase.storage
        .from('service-images')
        .getPublicUrl(fileName);

      setServiceImageUrl(urlData.publicUrl);
      setCropDialogOpen(false);
      toast.success('Imagem recortada com sucesso!');
    } catch {
      toast.error('Erro ao processar imagem');
    } finally {
      setUploadingImage(false);
    }
  };

  // Video upload handler
  const onSelectVideo = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files || e.target.files.length === 0 || !user) return;
    const file = e.target.files[0];

    // Validate file size
    if (file.size > MAX_VIDEO_SIZE_MB * 1024 * 1024) {
      toast.error(`O vídeo deve ter no máximo ${MAX_VIDEO_SIZE_MB}MB`);
      if (videoInputRef.current) videoInputRef.current.value = '';
      return;
    }

    // Validate video type
    if (!file.type.startsWith('video/')) {
      toast.error('Por favor, selecione um arquivo de vídeo válido');
      if (videoInputRef.current) videoInputRef.current.value = '';
      return;
    }

    // Validate duration
    const video = document.createElement('video');
    video.preload = 'metadata';
    
    const durationCheck = new Promise<boolean>((resolve) => {
      video.onloadedmetadata = () => {
        URL.revokeObjectURL(video.src);
        if (video.duration > MAX_VIDEO_DURATION) {
          toast.error(`O vídeo deve ter no máximo ${MAX_VIDEO_DURATION} segundos. Duração: ${Math.round(video.duration)}s`);
          resolve(false);
        } else {
          resolve(true);
        }
      };
      video.onerror = () => {
        toast.error('Erro ao ler o vídeo');
        resolve(false);
      };
    });
    
    video.src = URL.createObjectURL(file);
    const isValid = await durationCheck;
    
    if (!isValid) {
      if (videoInputRef.current) videoInputRef.current.value = '';
      return;
    }

    setUploadingVideo(true);
    try {
      const ext = file.name.split('.').pop() || 'mp4';
      const fileName = `${user.id}/${Date.now()}.${ext}`;
      const { error: uploadError } = await supabase.storage
        .from('service-videos')
        .upload(fileName, file, { contentType: file.type, upsert: true });

      if (uploadError) {
        toast.error('Erro ao enviar vídeo: ' + uploadError.message);
        return;
      }

      const { data: urlData } = supabase.storage
        .from('service-videos')
        .getPublicUrl(fileName);

      setServiceVideoUrl(urlData.publicUrl);
      toast.success('Vídeo enviado com sucesso!');
    } catch {
      toast.error('Erro ao processar vídeo');
    } finally {
      setUploadingVideo(false);
      if (videoInputRef.current) videoInputRef.current.value = '';
    }
  };

  const handleSave = async () => {
    if (!user) {
      toast.error('Você precisa estar logado');
      return;
    }
    if (!form.name.trim()) {
      toast.error('Preencha o nome do serviço');
      return;
    }

    const payload = {
      name: form.name.trim(),
      duration_minutes: form.duration_minutes,
      price: form.price,
      category: form.category,
      image_url: serviceImageUrl,
      video_url: serviceVideoUrl,
    };

    if (editingId) {
      const { data, error } = await supabase.from('services').update(payload).eq('id', editingId).eq('barber_id', user.id).select();
      if (error) { toast.error('Erro ao atualizar: ' + error.message); return; }
      if (!data || data.length === 0) { toast.error('Não foi possível atualizar.'); return; }
      toast.success('Serviço atualizado!');
    } else {
      const { error } = await supabase.from('services').insert({ ...payload, barber_id: user.id }).select();
      if (error) { toast.error('Erro ao criar: ' + error.message); return; }
      toast.success('Serviço criado!');
    }
    resetForm();
    fetchServices();
  };

  const handleDelete = async (id: string) => {
    await supabase.from('services').delete().eq('id', id);
    toast.success('Serviço removido!');
    fetchServices();
  };

  const startEdit = (s: Service) => {
    setEditingId(s.id);
    setForm({ name: s.name, duration_minutes: s.duration_minutes, price: Number(s.price), category: s.category || 'masculino' });
    setServiceImageUrl(s.image_url || null);
    setServiceVideoUrl(s.video_url || null);
    setShowForm(true);
    setTimeout(() => formRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' }), 100);
  };

  const resetForm = () => {
    setShowForm(false);
    setEditingId(null);
    setForm({ name: '', duration_minutes: 30, price: 0, category: 'masculino' });
    setServiceImageUrl(null);
    setServiceVideoUrl(null);
    setImgSrc('');
    if (fileInputRef.current) fileInputRef.current.value = '';
    if (videoInputRef.current) videoInputRef.current.value = '';
  };

  const removeVideo = () => {
    setServiceVideoUrl(null);
    if (videoInputRef.current) videoInputRef.current.value = '';
  };

  const masculinos = services.filter(s => (s.category || 'masculino') === 'masculino');
  const femininos = services.filter(s => (s.category || 'masculino') === 'feminino');

  const ServiceCard = ({ s }: { s: Service }) => (
    <div className="group relative bg-card border border-border rounded-2xl overflow-hidden transition-all hover:border-primary/30 hover:shadow-lg hover:shadow-primary/5">
      {/* Image / Video */}
      <div className="relative h-36 bg-secondary/50 overflow-hidden">
        {s.image_url ? (
          <img src={s.image_url} alt={s.name} className="w-full h-full object-cover" />
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <ImageIcon className="w-10 h-10 text-muted-foreground/30" />
          </div>
        )}
        {/* Video play button */}
        {s.video_url && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              setPreviewVideoUrl(s.video_url);
              setVideoPreviewDialogOpen(true);
            }}
            className="absolute bottom-2 left-2 p-1.5 bg-background/90 backdrop-blur-sm rounded-lg hover:bg-accent transition-colors flex items-center gap-1"
          >
            <Play className="w-3.5 h-3.5 text-primary fill-primary" />
            <span className="text-[10px] font-medium text-foreground">Vídeo</span>
          </button>
        )}
        {/* Overlay actions */}
        <div className="absolute top-2 right-2 flex gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity">
          <button
            onClick={() => startEdit(s)}
            className="p-2 bg-background/90 backdrop-blur-sm rounded-xl hover:bg-accent transition-colors"
          >
            <Pencil className="w-3.5 h-3.5 text-foreground" />
          </button>
          <button
            onClick={() => handleDelete(s.id)}
            className="p-2 bg-background/90 backdrop-blur-sm rounded-xl hover:bg-destructive/20 transition-colors"
          >
            <Trash2 className="w-3.5 h-3.5 text-destructive" />
          </button>
        </div>
      </div>
      {/* Info */}
      <div className="p-4 space-y-2">
        <h3 className="font-semibold text-foreground text-sm truncate">{s.name}</h3>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1 text-muted-foreground">
            <Clock className="w-3.5 h-3.5" />
            <span className="text-xs">{s.duration_minutes} min</span>
          </div>
          <span className="text-sm font-bold text-success">R$ {Number(s.price).toFixed(2)}</span>
        </div>
      </div>
    </div>
  );

  const ServiceSection = ({ title, emoji, items }: { title: string; emoji: string; items: Service[] }) => (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <span className="text-2xl">{emoji}</span>
        <div>
          <h2 className="text-xl font-bold font-display text-foreground">{title}</h2>
          <p className="text-xs text-muted-foreground">{items.length} serviço{items.length !== 1 ? 's' : ''} cadastrado{items.length !== 1 ? 's' : ''}</p>
        </div>
      </div>
      {items.length === 0 ? (
        <div className="border border-dashed border-border rounded-2xl p-8 text-center">
          <ImageIcon className="w-8 h-8 text-muted-foreground/30 mx-auto mb-2" />
          <p className="text-sm text-muted-foreground">Nenhum serviço cadastrado nesta categoria</p>
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          {items.map((s) => <ServiceCard key={s.id} s={s} />)}
        </div>
      )}
    </div>
  );

  return (
    <BarberLayout>
      <div className="max-w-4xl mx-auto space-y-8 animate-fade-in overflow-x-hidden">
        {/* Header */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
          <div>
            <h1 className="text-3xl font-bold font-display">Serviços/Barbeiro</h1>
            <p className="text-sm text-muted-foreground mt-1">Gerencie os serviços oferecidos</p>
          </div>
          <Button
            onClick={() => { resetForm(); setShowForm(true); }}
            className="rounded-xl animate-press"
          >
            <Plus className="w-4 h-4 mr-2" /> Novo Serviço
          </Button>
        </div>

        {/* Form */}
        {showForm && (
          <div ref={formRef} className="bg-card border border-border rounded-2xl p-6 space-y-5 animate-slide-up">
            <h3 className="font-semibold font-display text-lg">{editingId ? 'Editar' : 'Novo'} Serviço</h3>

            {/* Image & Video uploads */}
            <div className="flex flex-col sm:flex-row gap-4">
              {/* Image upload */}
              <div className="flex items-center gap-3 flex-1">
                <div
                  onClick={() => fileInputRef.current?.click()}
                  className="w-20 h-20 rounded-xl bg-secondary border-2 border-dashed border-border hover:border-primary/50 cursor-pointer flex items-center justify-center overflow-hidden transition-colors shrink-0"
                >
                  {serviceImageUrl ? (
                    <img src={serviceImageUrl} alt="Preview" className="w-full h-full object-cover" />
                  ) : (
                    <Camera className="w-5 h-5 text-muted-foreground" />
                  )}
                </div>
                <div className="space-y-0.5">
                  <p className="text-sm font-medium text-foreground">📷 Foto</p>
                  <p className="text-xs text-muted-foreground">Clique para adicionar</p>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    onChange={onSelectFile}
                    className="hidden"
                  />
                </div>
              </div>

              {/* Video upload */}
              <div className="flex items-center gap-3 flex-1">
                <div
                  onClick={() => !uploadingVideo && videoInputRef.current?.click()}
                  className={`w-20 h-20 rounded-xl bg-secondary border-2 border-dashed border-border hover:border-primary/50 cursor-pointer flex items-center justify-center overflow-hidden transition-colors shrink-0 ${uploadingVideo ? 'opacity-50 pointer-events-none' : ''}`}
                >
                  {serviceVideoUrl ? (
                    <video src={serviceVideoUrl} className="w-full h-full object-cover" muted />
                  ) : uploadingVideo ? (
                    <div className="animate-spin w-5 h-5 border-2 border-primary border-t-transparent rounded-full" />
                  ) : (
                    <Video className="w-5 h-5 text-muted-foreground" />
                  )}
                </div>
                <div className="space-y-0.5">
                  <p className="text-sm font-medium text-foreground">🎬 Vídeo</p>
                  <p className="text-xs text-muted-foreground">Até {MAX_VIDEO_DURATION}s</p>
                  {serviceVideoUrl && (
                    <button onClick={removeVideo} className="text-xs text-destructive hover:underline">
                      Remover vídeo
                    </button>
                  )}
                  <input
                    ref={videoInputRef}
                    type="file"
                    accept="video/*"
                    onChange={onSelectVideo}
                    className="hidden"
                  />
                </div>
              </div>
            </div>

            {/* Category selector */}
            <div className="flex gap-2">
              {CATEGORIES.map(cat => (
                <button
                  key={cat.value}
                  type="button"
                  onClick={() => setForm({ ...form, category: cat.value })}
                  className={`flex-1 py-2.5 px-3 rounded-xl text-sm font-medium border transition-all ${
                    form.category === cat.value
                      ? 'border-primary bg-primary/10 text-primary'
                      : 'border-border bg-secondary text-muted-foreground'
                  }`}
                >
                  {cat.label}
                </button>
              ))}
            </div>

            <Input
              placeholder="Nome do serviço"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              className="bg-secondary border-border rounded-xl h-11"
            />
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-sm text-muted-foreground mb-1 block flex items-center gap-1.5">
                  <Clock className="w-3.5 h-3.5" /> Duração (min)
                </label>
                <Input
                  type="number"
                  value={form.duration_minutes}
                  onChange={(e) => setForm({ ...form, duration_minutes: Number(e.target.value) })}
                  className="bg-secondary border-border rounded-xl h-11"
                />
              </div>
              <div>
                <label className="text-sm text-muted-foreground mb-1 block flex items-center gap-1.5">
                  <DollarSign className="w-3.5 h-3.5" /> Preço (R$)
                </label>
                <Input
                  type="number"
                  step="0.01"
                  value={form.price}
                  onChange={(e) => setForm({ ...form, price: Number(e.target.value) })}
                  className="bg-secondary border-border rounded-xl h-11"
                />
              </div>
            </div>
            <div className="flex gap-3">
              <Button onClick={handleSave} className="rounded-xl animate-press">
                <Check className="w-4 h-4 mr-2" /> Salvar
              </Button>
              <Button variant="outline" onClick={resetForm} className="rounded-xl animate-press">
                <X className="w-4 h-4 mr-2" /> Cancelar
              </Button>
            </div>
          </div>
        )}

        {/* Services sections */}
        <ServiceSection title="Masculino" emoji="💇‍♂️" items={masculinos} />
        <div className="border-t border-border" />
        <ServiceSection title="Feminino" emoji="💇‍♀️" items={femininos} />
      </div>

      {/* Crop Dialog */}
      <Dialog open={cropDialogOpen} onOpenChange={setCropDialogOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Recortar imagem</DialogTitle>
          </DialogHeader>
          <div className="flex flex-col items-center gap-4">
            {imgSrc && (
              <ReactCrop
                crop={crop}
                onChange={(c) => setCrop(c)}
                onComplete={(c) => setCompletedCrop(c)}
                aspect={4 / 3}
                className="max-h-[400px]"
              >
                <img
                  ref={imgRef}
                  src={imgSrc}
                  alt="Crop"
                  onLoad={onImageLoad}
                  className="max-h-[400px]"
                />
              </ReactCrop>
            )}
            <div className="flex gap-3 w-full">
              <Button onClick={handleCropSave} disabled={uploadingImage} className="flex-1 rounded-xl">
                {uploadingImage ? 'Salvando...' : 'Salvar recorte'}
              </Button>
              <Button variant="outline" onClick={() => setCropDialogOpen(false)} className="rounded-xl">
                Cancelar
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Video Preview Dialog */}
      <Dialog open={videoPreviewDialogOpen} onOpenChange={setVideoPreviewDialogOpen}>
        <DialogContent className="sm:max-w-lg p-0 overflow-hidden">
          <DialogHeader className="p-4 pb-0">
            <DialogTitle>Vídeo do serviço</DialogTitle>
          </DialogHeader>
          <div className="p-4 pt-2">
            {previewVideoUrl && (
              <video
                src={previewVideoUrl}
                controls
                autoPlay
                className="w-full rounded-xl max-h-[400px]"
                style={{ background: 'hsl(var(--secondary))' }}
              />
            )}
          </div>
        </DialogContent>
      </Dialog>
    </BarberLayout>
  );
}
