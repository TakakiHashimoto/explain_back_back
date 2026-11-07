import '/data/Projects/explain-back/apps/backend/node_modules/dotenv/config';
const {createClerkClient}=await import('/data/Projects/explain-back/apps/backend/node_modules/@clerk/express');
const clerk=createClerkClient({secretKey:process.env.CLERK_SECRET_KEY});
for (const email of ['e2e-user1+clerk_test@example.com','e2e-user2+clerk_test@example.com']) {
 try {const {data}=await clerk.users.getUserList({emailAddress:[email]});console.log(email, 'available:',data.length>0);}
 catch(e){console.log('Clerk test-user lookup unavailable:',e instanceof Error?e.name:'Unknown');process.exitCode=1;}
}
