"use client";

import { Camera, Loader2, Save, Trash2, LogOut, FileDown, Check, ChevronsUpDown } from "lucide-react";
import { useEffect, useState, useRef, useMemo } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { useAuth } from "@/contexts/auth-context";
import { usePlan } from "@/contexts/plan-context";
import { getSupabase } from "@/lib/supabase";
import { formatDisplayName } from "@/lib/utils";
import { deleteAccount, fetchCourseLabels } from "@/lib/api";
import { toast } from "sonner";

const TERMS = ["fall", "spring", "summer", "winter"] as const;
const TERM_LABELS: Record<string, string> = {
  fall: "Fall", spring: "Spring", summer: "Summer", winter: "Winter",
};
const currentYear = new Date().getFullYear();
const GRAD_YEARS = Array.from({ length: 12 }, (_, i) => currentYear - 2 + i);

export default function ProfilePage() {
  const router = useRouter();
  const { user, signOut } = useAuth();
  const {
    profile,
    majors,
    majorsLoading,
    doUpdateProfile,
    semesters,
    planCatalog,
  } = usePlan();

  // ── Form state ────────────────────────────────────────────────────────────
  const [avatar, setAvatar] = useState<string | null>(profile?.avatar_url ?? null);
  const [firstName, setFirstName] = useState(() => profile?.name?.split(" ")[0] ?? "");
  const [lastName, setLastName] = useState(() => profile?.name?.split(" ").slice(1).join(" ") ?? "");
  const [phone, setPhone] = useState(profile?.phone ?? "");
  const [major, setMajor] = useState(profile?.major_code ?? "");
  const [minor, setMinor] = useState(profile?.minor_code ?? "");
  const [gradTerm, setGradTerm] = useState(profile?.graduation_term ?? "spring");
  const [gradYear, setGradYear] = useState<number>(profile?.graduation_year ?? currentYear + 2);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [majorOpen, setMajorOpen] = useState(false);
  const [minorOpen, setMinorOpen] = useState(false);

  // Major change impact
  const [impactLoading, setImpactLoading] = useState(false);
  const [impactData, setImpactData] = useState<{ carryOver: number; becomeElective: number; newGaps: number } | null>(null);

  // All course codes in the plan
  const allPlanCodes = useMemo(() => {
    const codes: string[] = [];
    for (const sem of semesters) {
      for (const cid of sem.courseIds) {
        const c = planCatalog[cid];
        if (c) codes.push(c.code);
      }
    }
    return codes;
  }, [semesters, planCatalog]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const majorChanged = major !== (profile?.major_code ?? "");

  // Compute impact when major selection changes
  useEffect(() => {
    if (!majorChanged || !major || major === "UNDECLARED" || allPlanCodes.length === 0) {
      setImpactData(null);
      return;
    }
    setImpactLoading(true);
    fetchCourseLabels(major).then(({ labels }) => {
      let carryOver = 0, becomeElective = 0;
      for (const code of allPlanCodes) {
        const entry = labels[code];
        if (!entry) continue;
        if (entry.label === "Required" || entry.label === "Group Choice") carryOver++;
        else becomeElective++;
      }
      setImpactData({ carryOver, becomeElective, newGaps: 0 });
    }).catch((err) => { console.error("[profile] major impact calculation failed:", err); setImpactData(null); }).finally(() => setImpactLoading(false));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [major, majorChanged]);

  useEffect(() => {
    setAvatar(profile?.avatar_url ?? null);
    setFirstName(profile?.name?.split(" ")[0] ?? "");
    setLastName(profile?.name?.split(" ").slice(1).join(" ") ?? "");
    setPhone(profile?.phone ?? "");
    setMajor(profile?.major_code ?? "");
    setMinor(profile?.minor_code ?? "");
    setGradTerm(profile?.graduation_term ?? "spring");
    setGradYear(profile?.graduation_year ?? currentYear + 2);
  }, [
    profile?.avatar_url,
    profile?.name,
    profile?.phone,
    profile?.major_code,
    profile?.minor_code,
    profile?.graduation_term,
    profile?.graduation_year,
  ]);

  const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const allowedTypes = new Set(["image/jpeg", "image/png", "image/webp"]);
    if (!allowedTypes.has(file.type)) {
      toast.error("Upload a JPG, PNG, or WebP image");
      e.target.value = "";
      return;
    }
    if (file.size > 2 * 1024 * 1024) {
      toast.error("Profile picture must be 2 MB or smaller");
      e.target.value = "";
      return;
    }
    const reader = new FileReader();
    reader.onload = (ev) => setAvatar(ev.target?.result as string);
    reader.readAsDataURL(file);
    setUploading(true);
    try {
      const supabase = getSupabase();
      const userId = user?.id;
      if (!userId) throw new Error("Not authenticated");
      const ext = file.type === "image/png" ? "png" : file.type === "image/webp" ? "webp" : "jpg";
      const path = `${userId}/avatar.${ext}`;
      const { error: uploadError } = await supabase.storage
        .from("ProfilePictures")
        .upload(path, file, { contentType: file.type, upsert: true });
      if (uploadError) throw uploadError;
      const { data } = supabase.storage.from("ProfilePictures").getPublicUrl(path);
      setAvatar(data.publicUrl);
    } catch (err) {
      console.error("[profile] avatar upload failed:", err);
      toast.error("Failed to upload avatar");
    } finally {
      setUploading(false);
    }
  };

  const handleSave = async () => {
    if (!major) { toast.error("Please select a major"); return; }
    const year = Number(gradYear);
    if (!Number.isFinite(year) || year < 2000 || year > 2100) {
      toast.error("Enter a valid graduation year");
      return;
    }
    setSaving(true);
    try {
      const fullName = [firstName.trim(), lastName.trim()].filter(Boolean).join(" ");
      await doUpdateProfile({
        name: fullName || null,
        phone: phone || null,
        avatar_url: avatar || null,
        major_code: major,
        minor_code: minor || null,
        graduation_term: gradTerm,
        graduation_year: year,
      });
      toast.success(
        majorChanged
          ? "Profile saved — course labels updated for your new major"
          : "Profile saved"
      );
    } catch (err) {
      console.error("[profile] profile save failed:", err);
      toast.error("Failed to save profile");
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteAccount = async () => {
    setDeleting(true);
    try {
      const supabase = getSupabase();
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;
      if (!token) throw new Error("Not signed in");
      await deleteAccount(token);
      await supabase.auth.signOut();
      router.push("/");
    } catch (err) {
      console.error("[profile] delete account failed:", err);
      toast.error("Failed to delete account — try again");
      setDeleting(false);
    }
  };

  const majorName = formatDisplayName(
    majors.find((m) => m.code === profile?.major_code)?.name ?? profile?.major_code
  );
  const gradTermDisplay = profile?.graduation_term;
  const gradYearDisplay = profile?.graduation_year;
  const startTerm = profile?.start_term;
  const startYear = profile?.start_year;

  const capitalize = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

  function getInitials(n: string | null | undefined, email: string | null | undefined) {
    if (n) return n.split(" ").map((w) => w[0]).slice(0, 2).join("").toUpperCase();
    return (email?.[0] ?? "?").toUpperCase();
  }

  return (
    <div className="px-4 md:px-8 py-6 max-w-2xl mx-auto pb-8">
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
          <p className="text-base font-semibold text-foreground">{profile?.name ?? user?.email ?? ""}</p>
          {majorName && (
            <p className="text-sm text-muted-foreground">
              {majorName}
              {profile?.minor_code && (
                <span className="text-xs ml-1.5 text-muted-foreground/70">
                  · Minor: {formatDisplayName(majors.find((m) => m.code === profile.minor_code)?.name ?? profile.minor_code)}
                </span>
              )}
            </p>
          )}
          {startTerm && startYear && gradTermDisplay && gradYearDisplay && (
            <p className="text-xs text-muted-foreground mt-0.5">
              {capitalize(startTerm)} {startYear} → {capitalize(gradTermDisplay)} {gradYearDisplay}
            </p>
          )}
          {user?.email && <p className="text-xs text-muted-foreground mt-0.5">{user.email}</p>}
        </div>
      </div>

      {/* Edit profile — personal + academic in one form */}
      <div className="rounded-xl border border-border bg-card p-5 mb-4">
        <h2 className="text-sm font-semibold text-foreground mb-4">Edit Profile</h2>
        <div className="space-y-4">

          {/* Name */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1 block">First Name</label>
              <Input
                value={firstName}
                onChange={(e) => setFirstName(e.target.value)}
                placeholder="First name"
                className="h-9"
              />
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1 block">Last Name</label>
              <Input
                value={lastName}
                onChange={(e) => setLastName(e.target.value)}
                placeholder="Last name"
                className="h-9"
              />
            </div>
          </div>

          {/* Phone */}
          <div>
            <label className="text-xs font-medium text-muted-foreground mb-1 block">Phone</label>
            <Input
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="+1 (555) 000-0000"
              className="h-9"
            />
          </div>

          <div className="border-t border-border pt-4">
            {/* Major */}
            <div className="mb-3">
              <label className="text-xs font-medium text-muted-foreground mb-1 block">Major</label>
              <Popover open={majorOpen} onOpenChange={setMajorOpen}>
                <PopoverTrigger asChild>
                  <button
                    disabled={majorsLoading}
                    className="w-full h-9 px-3 flex items-center justify-between rounded-md border border-input bg-background text-sm text-left disabled:opacity-50 disabled:cursor-not-allowed hover:bg-accent/50 transition-colors"
                  >
                    <span className={major ? "text-foreground" : "text-muted-foreground"}>
                      {majorsLoading
                        ? "Loading…"
                        : major
                          ? formatDisplayName(majors.find((m) => m.code === major)?.name ?? major)
                          : "Select major"}
                    </span>
                    <ChevronsUpDown className="w-4 h-4 text-muted-foreground shrink-0" />
                  </button>
                </PopoverTrigger>
                <PopoverContent className="w-[var(--radix-popover-trigger-width)] p-0" align="start">
                  <Command>
                    <CommandInput placeholder="Search majors…" />
                    <CommandList>
                      <CommandEmpty>No major found.</CommandEmpty>
                      <CommandGroup>
                        {majors.map((m) => (
                          <CommandItem
                            key={m.code}
                            value={formatDisplayName(m.name ?? m.code) ?? m.code}
                            onSelect={() => { setMajor(m.code); setMajorOpen(false); }}
                          >
                            <Check className={`mr-2 h-4 w-4 ${major === m.code ? "opacity-100" : "opacity-0"}`} />
                            {formatDisplayName(m.name ?? m.code)}
                          </CommandItem>
                        ))}
                      </CommandGroup>
                    </CommandList>
                  </Command>
                </PopoverContent>
              </Popover>
            </div>

            {/* Minor */}
            <div className="mb-3">
              <label className="text-xs font-medium text-muted-foreground mb-1 block">Minor <span className="text-muted-foreground/60">(optional)</span></label>
              <Popover open={minorOpen} onOpenChange={setMinorOpen}>
                <PopoverTrigger asChild>
                  <button
                    disabled={majorsLoading}
                    className="w-full h-9 px-3 flex items-center justify-between rounded-md border border-input bg-background text-sm text-left disabled:opacity-50 disabled:cursor-not-allowed hover:bg-accent/50 transition-colors"
                  >
                    <span className={minor ? "text-foreground" : "text-muted-foreground"}>
                      {majorsLoading
                        ? "Loading…"
                        : minor
                          ? formatDisplayName(majors.find((m) => m.code === minor)?.name ?? minor)
                          : "No minor"}
                    </span>
                    <ChevronsUpDown className="w-4 h-4 text-muted-foreground shrink-0" />
                  </button>
                </PopoverTrigger>
                <PopoverContent className="w-[var(--radix-popover-trigger-width)] p-0" align="start">
                  <Command>
                    <CommandInput placeholder="Search minors…" />
                    <CommandList>
                      <CommandEmpty>No match found.</CommandEmpty>
                      <CommandGroup>
                        <CommandItem value="__none__" onSelect={() => { setMinor(""); setMinorOpen(false); }}>
                          <Check className={`mr-2 h-4 w-4 ${!minor ? "opacity-100" : "opacity-0"}`} />
                          No minor
                        </CommandItem>
                        {majors.filter((m) => m.code !== "UNDECLARED").map((m) => (
                          <CommandItem
                            key={m.code}
                            value={formatDisplayName(m.name ?? m.code) ?? m.code}
                            onSelect={() => { setMinor(m.code); setMinorOpen(false); }}
                          >
                            <Check className={`mr-2 h-4 w-4 ${minor === m.code ? "opacity-100" : "opacity-0"}`} />
                            {formatDisplayName(m.name ?? m.code)}
                          </CommandItem>
                        ))}
                      </CommandGroup>
                    </CommandList>
                  </Command>
                </PopoverContent>
              </Popover>
            </div>

            {/* Graduation */}
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1 block">Expected Graduation</label>
              <div className="grid grid-cols-2 gap-3">
                <Select value={gradTerm} onValueChange={setGradTerm}>
                  <SelectTrigger className="h-9">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {TERMS.map((t) => (
                      <SelectItem key={t} value={t}>{TERM_LABELS[t]}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Select value={String(gradYear)} onValueChange={(v) => setGradYear(Number(v))}>
                  <SelectTrigger className="h-9">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {GRAD_YEARS.map((y) => (
                      <SelectItem key={y} value={String(y)}>{y}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>

          {majorChanged && major && major !== "UNDECLARED" && (
            <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 space-y-2">
              <p className="text-xs font-semibold text-amber-800">Switching to {formatDisplayName(majors.find((m) => m.code === major)?.name ?? major)}</p>
              {impactLoading ? (
                <p className="text-xs text-amber-700">Calculating impact on your plan…</p>
              ) : impactData ? (
                <div className="grid grid-cols-2 gap-2">
                  <div className="bg-white/60 rounded-lg px-3 py-2 text-center">
                    <p className="text-base font-bold text-green-700">{impactData.carryOver}</p>
                    <p className="text-[10px] text-amber-700">courses carry over as required/group</p>
                  </div>
                  <div className="bg-white/60 rounded-lg px-3 py-2 text-center">
                    <p className="text-base font-bold text-amber-700">{impactData.becomeElective}</p>
                    <p className="text-[10px] text-amber-700">courses become electives</p>
                  </div>
                </div>
              ) : (
                <p className="text-xs text-amber-700">All course labels in your plan will refresh for the new major.</p>
              )}
              <p className="text-[10px] text-amber-600">Save to apply. You can always switch back.</p>
            </div>
          )}
          {majorChanged && major === "UNDECLARED" && (
            <p className="text-xs text-amber-600 bg-amber-50 border border-amber-200 rounded-md px-3 py-2">
              Setting to Undeclared will clear major-specific labels. Visit <strong>Explore Majors</strong> when you're ready to pick one.
            </p>
          )}
        </div>

        <div className="mt-4">
          <Button size="sm" onClick={handleSave} disabled={saving || uploading} className="gap-2">
            {saving
              ? <><Loader2 className="w-3.5 h-3.5 animate-spin" /> Saving…</>
              : <><Save className="w-3.5 h-3.5" /> Save Profile</>}
          </Button>
        </div>
      </div>

      {/* Export plan */}
      <div className="rounded-xl border border-border bg-card p-5 mt-4">
        <h2 className="text-sm font-semibold text-foreground mb-1">Export</h2>
        <p className="text-xs text-muted-foreground mb-4">
          Download a print-ready PDF of your full academic plan, including semesters, courses, credits, and grades.
        </p>
        <Button
          variant="outline"
          size="sm"
          className="gap-2"
          onClick={() => window.open("/plan-export", "_blank")}
        >
          <FileDown className="w-3.5 h-3.5" />
          Export Plan as PDF
        </Button>
      </div>

      {/* Account actions */}
      <div className="rounded-xl border border-border bg-card p-5 mt-4">
        <h2 className="text-sm font-semibold text-foreground mb-1">Account</h2>
        <p className="text-xs text-muted-foreground mb-4">
          Signed in as <span className="font-medium text-foreground">{user?.email}</span>
        </p>
        <Button
          variant="outline"
          size="sm"
          className="gap-2"
          onClick={() => signOut()}
        >
          <LogOut className="w-3.5 h-3.5" />
          Sign Out
        </Button>
      </div>

      {/* Danger zone */}
      <div className="rounded-xl border border-destructive/30 bg-card p-5 mt-4">
        <h2 className="text-sm font-semibold text-destructive mb-1">Danger Zone</h2>
        <p className="text-xs text-muted-foreground mb-4">
          Permanently deletes your account, plan, and all data. This cannot be undone.
        </p>
        <Button
          variant="outline"
          size="sm"
          className="border-destructive/40 text-destructive hover:bg-destructive hover:text-destructive-foreground gap-2"
          onClick={() => setDeleteDialogOpen(true)}
          disabled={deleting}
        >
          {deleting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
          Delete Account
        </Button>
      </div>

      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete your account?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete your plan, profile, and all course data.
              Your FiskGrad account will be removed and you will be signed out.
              This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="flex justify-end gap-3 mt-2">
            <AlertDialogCancel disabled={deleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteAccount}
              disabled={deleting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleting ? <><Loader2 className="w-3.5 h-3.5 animate-spin mr-1" /> Deleting…</> : "Yes, delete my account"}
            </AlertDialogAction>
          </div>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
