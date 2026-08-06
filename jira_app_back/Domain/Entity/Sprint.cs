using System;
using System.Collections.Generic;

namespace Domain.Entity
{
    public enum SprintStatus
    {
        Planned,
        Active,
        Completed
    }

    public class Sprint
    {
        public int Id { get; set; }
        public string Name { get; set; } = string.Empty;
        public string? Goal { get; set; }
        public DateTime? StartDate { get; set; }
        public DateTime? EndDate { get; set; }
        public SprintStatus Status { get; set; } = SprintStatus.Planned;

        // Relation vers Project
        public int ProjectId { get; set; }
        public Project? Project { get; set; }

        // Tickets du sprint
        public ICollection<Ticket> Tickets { get; set; } = new List<Ticket>();

        // Développeurs assignés à ce sprint
        public ICollection<SprintMember> SprintMembers { get; set; } = new List<SprintMember>();
    }
}
