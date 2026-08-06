using System;

namespace Domain.Entity
{
    public class SprintMember
    {
        public int SprintId { get; set; }
        public Sprint Sprint { get; set; } = null!;
        public int UserId { get; set; }
        public User User { get; set; } = null!;
    }
}
