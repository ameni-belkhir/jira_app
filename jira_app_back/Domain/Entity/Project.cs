using System;
using System.Collections.Generic;

namespace Domain.Entity
{
    public class Project
    {
        public int Id { get; set; }
        public string Nom { get; set; } = string.Empty;
        // Responsable stored as a simple string (could be user name or id as string)
        public string Responsable { get; set; } = string.Empty;
        public string Description { get; set; } = string.Empty;

// Utilisateur qui a créé le projet (FK vers User)
        public int CreatedById { get; set; }

        // Propriété de navigation vers le créateur du projet
        public User? Creator { get; set; }

        // Membres du projet (avec rôle) — contient notamment tous les Scrum Masters
        public ICollection<ProjectMember> Members { get; set; } = new List<ProjectMember>();

        // Tickets associés au projet
        public ICollection<Ticket> Tickets { get; set; } = new List<Ticket>();
        // Sprints associés au projet
        public ICollection<Sprint> Sprints { get; set; } = new List<Sprint>();
    }
}
