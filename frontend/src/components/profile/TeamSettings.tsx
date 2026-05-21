import React, { useEffect, useState } from "react";
import { getTeams, createTeam, addTeamMember, Team } from "@/lib/api";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/contexts/AuthContext";

export const TeamSettings = () => {
    const [teams, setTeams] = useState<Team[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const { toast } = useToast();
    const { user } = useAuth();
    
    const [isCreateOpen, setIsCreateOpen] = useState(false);
    const [newTeamName, setNewTeamName] = useState("");
    const [newTeamDesc, setNewTeamDesc] = useState("");

    const [isAddMemberOpen, setIsAddMemberOpen] = useState<number | null>(null);
    const [newMemberUserId, setNewMemberUserId] = useState("");

    useEffect(() => {
        loadTeams();
    }, []);

    const loadTeams = async () => {
        setIsLoading(true);
        try {
            const data = await getTeams();
            setTeams(data);
        } catch (error: any) {
            toast({ title: "Error", description: error.message, variant: "destructive" });
        } finally {
            setIsLoading(false);
        }
    };

    const handleCreateTeam = async () => {
        try {
            await createTeam({ name: newTeamName, description: newTeamDesc });
            toast({ title: "Success", description: "Team created successfully" });
            setIsCreateOpen(false);
            setNewTeamName("");
            setNewTeamDesc("");
            loadTeams();
        } catch (error: any) {
            toast({ title: "Error", description: error.message, variant: "destructive" });
        }
    };

    const handleAddMember = async (teamId: number) => {
        try {
            await addTeamMember(teamId, { userId: parseInt(newMemberUserId), role: "member" });
            toast({ title: "Success", description: "Member added successfully" });
            setIsAddMemberOpen(null);
            setNewMemberUserId("");
            loadTeams();
        } catch (error: any) {
            toast({ title: "Error", description: error.message, variant: "destructive" });
        }
    };

    return (
        <Card className="mt-6">
            <CardHeader>
                <div className="flex justify-between items-center">
                    <div>
                        <CardTitle>Teams</CardTitle>
                        <CardDescription>Manage your collaborative teams</CardDescription>
                    </div>
                    <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
                        <DialogTrigger asChild>
                            <Button className="bg-[#00A4EF] hover:bg-[#007BB5] text-white">Create Team</Button>
                        </DialogTrigger>
                        <DialogContent>
                            <DialogHeader>
                                <DialogTitle>Create New Team</DialogTitle>
                                <DialogDescription>Form a team to bid on projects together.</DialogDescription>
                            </DialogHeader>
                            <div className="space-y-4">
                                <div>
                                    <Label>Team Name</Label>
                                    <Input value={newTeamName} onChange={(e) => setNewTeamName(e.target.value)} placeholder="e.g. Dream Team" />
                                </div>
                                <div>
                                    <Label>Description</Label>
                                    <Textarea value={newTeamDesc} onChange={(e) => setNewTeamDesc(e.target.value)} placeholder="What does your team do?" />
                                </div>
                                <Button onClick={handleCreateTeam} className="w-full">Create</Button>
                            </div>
                        </DialogContent>
                    </Dialog>
                </div>
            </CardHeader>
            <CardContent>
                {isLoading ? (
                    <p className="text-sm text-muted-foreground">Loading teams...</p>
                ) : teams.length === 0 ? (
                    <p className="text-sm text-muted-foreground">You are not part of any teams yet.</p>
                ) : (
                    <div className="space-y-6">
                        {teams.map((team) => (
                            <div key={team.id} className="border p-4 rounded-lg bg-white shadow-sm space-y-4">
                                <div className="flex justify-between items-start">
                                    <div>
                                        <h3 className="font-semibold text-lg">{team.name}</h3>
                                        <p className="text-sm text-muted-foreground">{team.description}</p>
                                    </div>
                                    {team.creatorId === user?.id && (
                                        <Dialog open={isAddMemberOpen === team.id} onOpenChange={(open) => setIsAddMemberOpen(open ? team.id : null)}>
                                            <DialogTrigger asChild>
                                                <Button variant="outline" size="sm">Add Member</Button>
                                            </DialogTrigger>
                                            <DialogContent>
                                                <DialogHeader>
                                                    <DialogTitle>Add Member to {team.name}</DialogTitle>
                                                    <DialogDescription>Enter the User ID of the person you want to add.</DialogDescription>
                                                </DialogHeader>
                                                <div className="space-y-4">
                                                    <div>
                                                        <Label>User ID</Label>
                                                        <Input value={newMemberUserId} onChange={(e) => setNewMemberUserId(e.target.value)} placeholder="e.g. 42" type="number" />
                                                    </div>
                                                    <Button onClick={() => handleAddMember(team.id)} className="w-full">Add to Team</Button>
                                                </div>
                                            </DialogContent>
                                        </Dialog>
                                    )}
                                </div>
                                <div>
                                    <h4 className="text-sm font-medium mb-2">Members ({team.members?.length})</h4>
                                    <div className="flex flex-wrap gap-2">
                                        {team.members?.map((m) => (
                                            <div key={m.id} className="flex items-center gap-2 bg-gray-100 px-3 py-1.5 rounded-full text-sm">
                                                <img src={m.user?.avatarUrl || "https://api.dicebear.com/7.x/avataaars/svg?seed=" + m.user?.username} alt={m.user?.username} className="w-6 h-6 rounded-full" />
                                                <span>{m.user?.displayName || m.user?.username}</span>
                                                <span className="text-xs text-muted-foreground ml-1 bg-white px-1.5 py-0.5 rounded uppercase">{m.role}</span>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </CardContent>
        </Card>
    );
};
