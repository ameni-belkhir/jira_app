using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Threading.Tasks;

namespace Domain.Entity
{
    public class Role
    {
        public int Id { get; set; }
        public string Description { get; set; } = string.Empty;

        // Propriété de navigation pour Entity Framework (relation 1-N avec User)
        public ICollection<User> Users { get; set; } = new List<User>();
    }
}
