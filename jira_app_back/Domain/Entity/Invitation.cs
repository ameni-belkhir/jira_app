using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Threading.Tasks;

namespace Domain.Entity
{
    public class Invitation
    {
        public int Id { get; set; }

        // Email invité
        public string Email { get; set; } = string.Empty;

        // Rôle demandé (ex: "Senior" ou "Developer")
        public string Role { get; set; } = string.Empty;

        // Projet lié (optionnel)
        public int? ProjectId { get; set; }

        // Token d'invitation (GUID string)
        public string Token { get; set; } = string.Empty;

        // Indique si l'invitation a déjà été utilisée
        public bool IsUsed { get; set; } = false;

        public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    }
}
