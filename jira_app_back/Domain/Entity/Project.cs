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

        // Membres du projet
        public ICollection<User> Members { get; set; } = new List<User>();

        // Tickets associés au projet
        public ICollection<Ticket> Tickets { get; set; } = new List<Ticket>();
        // Sprints associés au projet
        public ICollection<Sprint> Sprints { get; set; } = new List<Sprint>();
    }
}
