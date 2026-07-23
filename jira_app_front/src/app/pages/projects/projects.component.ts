import { Component } from '@angular/core';
import { RouterModule } from '@angular/router';
import { CommonModule } from '@angular/common';
import { ProjectCardComponent } from './project-card/project-card.component';
import type { Project } from '../dashboard/dashboard.component';

@Component({
  selector: 'app-projects',
  standalone: true,
  imports: [RouterModule, CommonModule, ProjectCardComponent],
  templateUrl: './projects.component.html',
  styles: ``
})
export class ProjectsComponent {
  projects: Project[] = [
    {
      id: 1,
      name: 'CRM System',
      description: 'Customer relationship management platform with analytics and reporting.',
      ticketCount: 18,
      totalTickets: 24,
      status: 'In Progress',
      statusColor: 'text-brand-500',
      teamMembers: ['/images/user/user-01.jpg', '/images/user/user-02.jpg', '/images/user/user-03.jpg'],
      dueDate: 'Dec 15, 2026'
    },
    {
      id: 2,
      name: 'E-Commerce Website',
      description: 'Online shopping platform with payment gateway integration.',
      ticketCount: 12,
      totalTickets: 30,
      status: 'Active',
      statusColor: 'text-success-500',
      teamMembers: ['/images/user/user-04.jpg', '/images/user/user-05.jpg'],
      dueDate: 'Jan 10, 2027'
    },
    {
      id: 3,
      name: 'Mobile Application',
      description: 'Cross-platform mobile app built with Flutter for iOS and Android.',
      ticketCount: 7,
      totalTickets: 18,
      status: 'Planning',
      statusColor: 'text-orange-500',
      teamMembers: ['/images/user/user-06.jpg', '/images/user/user-07.jpg', '/images/user/user-08.jpg'],
      dueDate: 'Feb 28, 2027'
    },
    {
      id: 4,
      name: 'Internal HR',
      description: 'Employee management system with payroll and leave tracking.',
      ticketCount: 22,
      totalTickets: 22,
      status: 'Completed',
      statusColor: 'text-success-600',
      teamMembers: ['/images/user/user-09.jpg', '/images/user/user-10.jpg'],
      dueDate: 'Nov 5, 2026'
    },
    {
      id: 5,
      name: 'Inventory System',
      description: 'Warehouse inventory tracking with barcode scanning and real-time updates.',
      ticketCount: 9,
      totalTickets: 15,
      status: 'In Review',
      statusColor: 'text-purple-500',
      teamMembers: ['/images/user/user-11.jpg', '/images/user/user-12.jpg', '/images/user/user-13.jpg'],
      dueDate: 'Mar 20, 2027'
    }
  ];
}
