CREATE TABLE public.project_versions (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  project_id uuid NOT NULL,
  user_id uuid NOT NULL,
  message_id uuid,
  files jsonb NOT NULL DEFAULT '{}'::jsonb,
  summary text NOT NULL DEFAULT '',
  thought_ms integer NOT NULL DEFAULT 0,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

CREATE INDEX project_versions_project_idx ON public.project_versions(project_id, created_at DESC);

ALTER TABLE public.project_versions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "versions_select_own" ON public.project_versions FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "versions_insert_own" ON public.project_versions FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "versions_delete_own" ON public.project_versions FOR DELETE USING (auth.uid() = user_id);

ALTER TABLE public.projects ADD COLUMN IF NOT EXISTS files jsonb NOT NULL DEFAULT '{}'::jsonb;