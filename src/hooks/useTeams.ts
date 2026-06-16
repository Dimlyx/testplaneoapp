import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useUserOrganization } from '@/hooks/useUserOrganization';

export interface Team {
  id: string;
  name: string;
  organization_id: string;
  leader_id: string;
  created_at: string;
  updated_at: string;
}

export interface TeamMember {
  id: string;
  team_id: string;
  user_id: string;
  created_at: string;
}

export interface TeamWithMembers extends Team {
  members: TeamMember[];
}

export function useTeams() {
  const { data: organizationId } = useUserOrganization();

  return useQuery({
    queryKey: ['teams', organizationId],
    queryFn: async () => {
      if (!organizationId) return [];

      const { data: teams, error } = await supabase
        .from('teams')
        .select('*')
        .eq('organization_id', organizationId)
        .order('name');
      if (error) throw error;

      const teamIds = (teams || []).map((t: Team) => t.id);
      let members: TeamMember[] = [];
      if (teamIds.length > 0) {
        const { data: m, error: membersError } = await supabase
          .from('team_members')
          .select('*')
          .in('team_id', teamIds);
        if (membersError) throw membersError;
        members = (m || []) as TeamMember[];
      }

      return (teams || []).map((team: Team) => ({
        ...team,
        members: members.filter((m: TeamMember) => m.team_id === team.id),
      })) as TeamWithMembers[];
    },
    enabled: !!organizationId,
  });
}

export function useCreateTeam() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (data: { name: string; leader_id: string; organization_id: string; member_ids: string[] }) => {
      const { data: team, error } = await supabase
        .from('teams')
        .insert({ name: data.name, leader_id: data.leader_id, organization_id: data.organization_id })
        .select()
        .single();
      if (error) throw error;

      // Add leader + members
      const allMemberIds = [...new Set([data.leader_id, ...data.member_ids])];
      const memberRows = allMemberIds.map(uid => ({ team_id: team.id, user_id: uid }));
      const { error: mError } = await supabase.from('team_members').insert(memberRows);
      if (mError) throw mError;

      return team;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['teams'] }),
  });
}

export function useUpdateTeam() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (data: { id: string; name: string; leader_id: string; member_ids: string[] }) => {
      const { error } = await supabase
        .from('teams')
        .update({ name: data.name, leader_id: data.leader_id })
        .eq('id', data.id);
      if (error) throw error;

      // Replace members: delete all, re-insert
      await supabase.from('team_members').delete().eq('team_id', data.id);
      const allMemberIds = [...new Set([data.leader_id, ...data.member_ids])];
      const memberRows = allMemberIds.map(uid => ({ team_id: data.id, user_id: uid }));
      const { error: mError } = await supabase.from('team_members').insert(memberRows);
      if (mError) throw mError;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['teams'] }),
  });
}

export function useDeleteTeam() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (teamId: string) => {
      const { error } = await supabase.from('teams').delete().eq('id', teamId);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['teams'] }),
  });
}
