"use client";

import { GraduationCap, BookOpen, TrendingUp, Download, Camera, Loader2, Save } from "lucide-react";
import { useEffect, useState, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useAuth } from "@/contexts/auth-context";
import { usePlan } from "@/contexts/plan-context";
import { getCompletedCredits } from "@/lib/data";
import { getSupabase } from "@/lib/supabase";
import { toast } from "sonner";

const DEGREE_CREDITS = 120;

export default function ProfilePage() {
  const { user } = useAuth();
  const { profile, semesters, planCatalog, majors, doUpdateProfile } = usePlan();
  const [avatar, setAvatar] = useState<string | null>(profile?.avatar_url ?? null);
  const [name, setName] = useState(profile?.name ?? "");
  const [phone, setPhone] = useState(profile?.phone ?? "");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setAvatar(profile?.avatar_url ?? null);
    setName(profile?.name ?? "");
    setPhone(profile?.phone ?? "");
  }, [profile?.avatar_url, profile?.name, profile?.phone]);

  const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Show local preview immediately
    const reader = new FileReader();
    reader.onload = (ev) => setAvatar(ev.target?.result as string);
    reader.readAsDataURL(file);

    // Upload to Supabase Storage
    setUploading(true);
    try {
      const supabase = getSupabase();
      const userId = user?.id;
      if (!userId) throw new Error("Not authenticated");

      const ext = file.name.split(".").pop() ?? "jpg";
      const path = `${userId}/avatar.${ext}`;

      const { error: uploadError } = await supabase.storage
        .from("ProfilePictures")
        .upload(path, file, { upsert: true });
      if (uploadError) throw uploadError;

      const { data } = supabase.storage
        .from("ProfilePictures")
        .getPublicUrl(path);

      setAvatar(data.publicUrl);
    } catch {
      toast.error("Failed to upload avatar");
    } finally {
      setUploading(false);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    setSaved(false);
    try {
      await doUpdateProfile({ name: name || null, phone: phone || null, avatar_url: avatar || null });
      setSaved(true);
      toast.success("Profile updated");
      setTimeout(() => setSaved(false), 3000);
    } catch {
      toast.error("Failed to save profile");
    } finally {
      setSaving(false);
    }
  };

  const completedCredits = getCompletedCredits(semesters, planCatalog);
  const remainingCredits = Math.max(0, DEGREE_CREDITS - completedCredits);
  const gpa = profile?.gpa ?? null;

  const majorCode = profile?.major_code;
  const majorName = majors.find((m) => m.code === majorCode)?.name ?? majorCode;
  const gradTerm = profile?.graduation_term;
  const gradYear = profile?.graduation_year;
  const startTerm = profile?.start_term;
  const startYear = profile?.start_year;

  const capitalize = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

  function getInitials(n: string | null | undefined, email: string | null | undefined) {
    if (n) return n.split(" ").map((w) => w[0]).slice(0, 2).join("").toUpperCase();
    return (email?.[0] ?? "?").toUpperCase();
  }

  return (
    <div className="px-4 md:px-8 py-6 max-w-2xl mx-auto pb-20 md:pb-8">
      <h1 className="text-xl font-bold text-foreground mb-6">Profile</h1>

      {/* Avatar card */}
      <div className="flex items-center gap-4 p-5 rounded-xl border border-border bg-card mb-6">
        <div className="relative">
          {avatar ? (
            <img src={avatar} alt="Avatar" className="w-16 h-16 rounded-full object-cover" />
          ) : (
            <div className="w-16 h-16 rounded-full bg-primary flex items-center justify-center text-primary-foreground text-xl font-bold">
              {getInitials(profile?.name, user?.email)}
            </div>
          )}
          <button
            onClick={() => fileInputRef.current?.click()}
            disabled={uploading}
            className="absolute bottom-0 right-0 w-6 h-6 rounded-full bg-primary text-primary-foreground flex items-center justify-center hover:bg-primary/90 transition-colors shadow-md disabled:opacity-60"
            title="Upload avatar"
          >
            {uploading ? <Loader2 className="w-3 h-3 animate-spin" /> : <Camera className="w-3 h-3" />}
          </button>
          <input ref={fileInputRef} type="file" accept="image/*" onChange={handleAvatarUpload} className="hidden" />
        </div>
        <div>
          <p className="text-base font-semibold text-foreground">{profile?.name ?? user?.email ?? "—"}</p>
          {majorName && <p className="text-sm text-muted-foreground">{majorName}</p>}
          {startTerm && startYear && gradTerm && gradYear && (
            <p className="text-xs text-muted-foreground mt-0.5">
              {capitalize(startTerm)} {startYear} → {capitalize(gradTerm)} {gradYear}
            </p>
          )}
          {user?.email && <p className="text-xs text-muted-foreground mt-0.5">{user.email}</p>}
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-3 mb-6">
        {[
          { label: "Cumulative GPA", value: gpa !== null ? gpa.toFixed(2) : "—", icon: TrendingUp },
          { label: "Credits Completed", value: String(completedCredits), icon: BookOpen },
          { label: "Credits Remaining", value: String(remainingCredits), icon: GraduationCap },
        ].map(({ label, value, icon: Icon }) => (
          <div key={label} className="rounded-xl border border-border bg-card p-4 flex flex-col gap-2">
            <Icon className="w-4 h-4 text-muted-foreground" />
            <p className="text-xl font-bold text-foreground">{value}</p>
            <p className="text-xs text-muted-foreground">{label}</p>
          </div>
        ))}
      </div>

      {/* Edit profile */}
      <div className="rounded-xl border border-border bg-card p-5 mb-4">
        <h2 className="text-sm font-semibold text-foreground mb-4">Edit Profile</h2>
        <div className="space-y-3">
          <div>
            <label className="text-xs font-medium text-muted-foreground mb-1 block">Full Name</label>
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Your full name"
              className="h-9"
            />
          </div>
          <div>
            <label className="text-xs font-medium text-muted-foreground mb-1 block">Phone</label>
            <Input
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="+1 (555) 000-0000"
              className="h-9"
            />
          </div>
        </div>
        <div className="mt-4 flex items-center gap-3">
          <Button size="sm" onClick={handleSave} disabled={saving} className="gap-2">
            {saving ? <><Loader2 className="w-3.5 h-3.5 animate-spin" /> Saving…</> : <><Save className="w-3.5 h-3.5" /> Save Changes</>}
          </Button>
          {saved && <span className="text-xs text-green-600">Saved!</span>}
        </div>
      </div>

      {/* Advisor export */}
      <div className="p-5 rounded-xl border border-primary/20 bg-primary/5 flex items-center justify-between gap-4 mb-4">
        <div>
          <p className="text-sm font-semibold text-foreground">Advisor Export</p>
          <p className="text-xs text-muted-foreground mt-0.5">Download a clean PDF of your plan for your advisor meeting.</p>
        </div>
        <Button variant="outline" size="sm" className="gap-2 flex-shrink-0" onClick={() => window.print()}>
          <Download className="w-3.5 h-3.5" /> Export PDF
        </Button>
      </div>

      {/* Graduation status */}
      {gradTerm && gradYear && (
        <div className="p-4 rounded-xl border border-border bg-card text-sm text-muted-foreground leading-relaxed">
          At your current pace, you&apos;ll graduate{" "}
          <span className="font-semibold text-foreground">{capitalize(gradTerm)} {gradYear}</span>.{" "}
          You&apos;re {Math.round((completedCredits / DEGREE_CREDITS) * 100)}% of the way through your degree requirements.
        </div>
      )}
    </div>
  );
}
