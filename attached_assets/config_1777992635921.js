export const APPS = {
  traydbook: {
    url: 'https://dev.traydbook.com',
    type: 'marketplace',
    users: {
      contractor: { 
        role: 'contractor', 
        flow: 'signup → profile → findJobs → bid',
        data: { trade: 'electrician', display_name: 'Sim Electrician' }
      },
      owner: { 
        role: 'project_owner', 
        flow: 'signup → profile → buyCredits → postJob → reviewBids',
        data: { account_type: 'project_owner' }
      },
      agent: { 
        role: 'agent', 
        flow: 'signup → profile → buyCredits → postRFQ → message',
        data: { account_type: 'agent' }
      },
      homeowner: {
        role: 'homeowner',
        flow: 'signup → profile → buyCredits → postJob → reviewBids',
        data: { account_type: 'homeowner' }
      },
      investor: {
        role: 'investor',
        flow: 'signup → profile → buyCredits → postRFQ → message',
        data: { account_type: 'investor' }
      }
    }
  }
  // Add more apps here:
  // app2: { url: 'https://yourapp.com', type: 'saas', users: {...} }
};
