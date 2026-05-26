const FIRST_NAMES = ["James","Mary","John","Patricia","Robert","Jennifer","Michael","Linda","William","Elizabeth","David","Barbara","Richard","Susan","Joseph","Jessica","Thomas","Sarah","Charles","Karen","Christopher","Nancy","Daniel","Lisa","Matthew","Betty","Anthony","Margaret","Mark","Sandra","Donald","Ashley","Steven","Kimberly","Paul","Emily","Andrew","Donna","Joshua","Michelle","Kenneth","Dorothy","Kevin","Carol","Brian","Amanda","George","Melissa","Timothy","Deborah","Ronald","Stephanie","Edward","Rebecca","Jason","Sharon","Jeffrey","Laura","Ryan","Cynthia","Jacob","Kathleen","Gary","Amy","Nicholas","Shirley","Eric","Angela","Jonathan","Helen","Stephen","Anna","Larry","Brenda","Justin","Pamela","Scott","Nicole","Brandon","Emma","Benjamin","Samantha","Samuel","Katherine","Gregory","Christine","Alexander","Debra","Frank","Rachel","Patrick","Catherine","Raymond","Janet","Jack","Ruth"];

const LAST_NAMES = ["Smith","Johnson","Williams","Brown","Jones","Garcia","Miller","Davis","Rodriguez","Martinez","Hernandez","Lopez","Gonzalez","Wilson","Anderson","Thomas","Taylor","Moore","Jackson","Martin","Lee","Perez","Thompson","White","Harris","Sanchez","Clark","Ramirez","Lewis","Robinson","Walker","Young","Allen","King","Wright","Scott","Torres","Nguyen","Hill","Flores","Green","Adams","Nelson","Baker","Hall","Rivera","Campbell","Mitchell","Carter","Roberts","Gomez","Phillips","Evans","Turner","Diaz","Parker","Cruz","Edwards","Collins","Reyes","Stewart","Morris","Morales","Murphy","Cook","Rogers","Gutierrez","Ortiz","Morgan","Cooper","Peterson","Bailey","Reed","Kelly","Howard","Ramos","Kim","Cox","Ward","Richardson","Watson","Brooks","Chavez","Wood","James","Bennett","Gray","Mendoza","Ruiz","Hughes","Price","Alvarez","Castillo","Sanders","Patel","Myers"];

const DOMAINS = ["gmail.com","yahoo.com","outlook.com","hotmail.com","icloud.com"];

const BIOS: Record<string, string[]> = {
  facebook: ["Living life one day at a time. Love travel, food, and good company.","Entrepreneur | Tech enthusiast | Coffee addict","Just here to connect with friends and share memories.","Family first. Everything else is secondary.","Music lover, weekend warrior, eternal optimist."],
  linkedin: ["Professional with 5+ years experience in technology and business development.","Connecting professionals and building networks. Open to new opportunities.","Results-driven leader with expertise in digital transformation.","Passionate about innovation and building high-performing teams.","Strategic thinker with a track record of delivering results."],
  instagram: ["Capturing moments through my lens. 📸","Foodie | Traveler | Lifestyle","Just sharing my daily adventures.","Living my best life, one photo at a time.","Visual storyteller. Welcome to my world."],
  tiktok: ["Creating content that makes you smile 😊","Dance | Comedy | Life hacks","Follow for daily entertainment!","Just here to have fun and make you laugh.","Your daily dose of creativity and chaos."],
  lemon8: ["Sharing lifestyle tips and inspiration ✨","Beauty | Fashion | Wellness","Your daily dose of positivity.","Living consciously, sharing generously.","Creator of cozy content and good vibes."],
  traydbook: ["Skilled contractor specializing in residential and commercial projects.","Licensed professional with 10+ years experience. Quality work guaranteed.","Reliable contractor ready for your next project. Get a free quote!","Expert in renovations, repairs, and new construction.","Building dreams, one project at a time. Licensed and insured."],
};

const CITIES = [{city:"New York",state:"NY"},{city:"Los Angeles",state:"CA"},{city:"Chicago",state:"IL"},{city:"Houston",state:"TX"},{city:"Phoenix",state:"AZ"},{city:"Philadelphia",state:"PA"},{city:"San Antonio",state:"TX"},{city:"San Diego",state:"CA"},{city:"Dallas",state:"TX"},{city:"San Jose",state:"CA"},{city:"Austin",state:"TX"},{city:"Jacksonville",state:"FL"},{city:"Fort Worth",state:"TX"},{city:"Columbus",state:"OH"},{city:"Charlotte",state:"NC"},{city:"Indianapolis",state:"IN"},{city:"San Francisco",state:"CA"},{city:"Seattle",state:"WA"},{city:"Denver",state:"CO"},{city:"Washington",state:"DC"},{city:"Boston",state:"MA"},{city:"El Paso",state:"TX"},{city:"Nashville",state:"TN"},{city:"Detroit",state:"MI"},{city:"Oklahoma City",state:"OK"},{city:"Portland",state:"OR"},{city:"Las Vegas",state:"NV"},{city:"Louisville",state:"KY"},{city:"Baltimore",state:"MD"},{city:"Milwaukee",state:"WI"}];

export interface Persona {
  firstName: string;
  lastName: string;
  email: string;
  emailPassword: string;
  username: string;
  displayName: string;
  phone: string;
  bio: string;
  avatarSeed: string;
  dateOfBirth: string;
  location: { city: string; state: string; country: string };
}

export class IdentityFactory {
  private usedEmails = new Set<string>();
  private usedUsernames = new Set<string>();
  
  generatePersona(platformType: string, index: number, emailBase: string): Persona {
    const seed = this.hashSeed(index);
    const firstName = FIRST_NAMES[seed % FIRST_NAMES.length];
    const lastName = LAST_NAMES[(seed + 7) % LAST_NAMES.length];
    
    let email: string, attempts = 0;
    do {
      const tag = `sim${String(seed).padStart(3, '0').slice(-6)}${attempts > 0 ? attempts : ''}`;
      const [local, domain] = emailBase.split('@');
      email = `${local}+${tag}@${domain}`;
      attempts++;
    } while (this.usedEmails.has(email) && attempts < 100);
    this.usedEmails.add(email);
    
    let username: string;
    attempts = 0;
    do {
      const suffix = attempts === 0 ? '' : `${attempts}`;
      username = `${firstName.toLowerCase()}${lastName.toLowerCase().slice(0, 3)}${seed % 100}${suffix}`;
      attempts++;
    } while (this.usedUsernames.has(username) && attempts < 100);
    this.usedUsernames.add(username);
    
    const bios = BIOS[platformType] || BIOS.facebook;
    
    return {
      firstName, lastName, email,
      emailPassword: this.generatePassword(seed),
      username, displayName: `${firstName} ${lastName}`,
      phone: this.generatePhone(seed),
      bio: bios[seed % bios.length],
      avatarSeed: `${firstName}_${lastName}_${seed}`,
      dateOfBirth: this.generateDateOfBirth(seed),
      location: this.generateLocation(seed),
    };
  }
  
  generateBatch(platformType: string, count: number, emailBase: string): Persona[] {
    const personas: Persona[] = [];
    for (let i = 0; i < count; i++) personas.push(this.generatePersona(platformType, i, emailBase));
    return personas;
  }
  
  private hashSeed(index: number): number {
    return (index * 2654435761 + 104395301) % 2147483647;
  }
  
  private generatePassword(seed: number): string {
    const chars = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%^&*";
    let password = "", base = seed.toString();
    for (let i = 0; i < 16; i++) password += chars[(seed * (i + 1) + parseInt(base[i % base.length] || "0")) % chars.length];
    return password;
  }
  
  private generatePhone(seed: number): string {
    const areaCodes = [212,310,415,512,617,713,805,916,305,404,503,702,801,904,615];
    const area = areaCodes[seed % areaCodes.length];
    return `+1${area}${200 + (seed % 800)}${1000 + (seed % 9000)}`;
  }
  
  private generateDateOfBirth(seed: number): string {
    const year = 1980 + (seed % 30), month = 1 + (seed % 12), day = 1 + (seed % 28);
    return `${month.toString().padStart(2, '0')}/${day.toString().padStart(2, '0')}/${year}`;
  }
  
  private generateLocation(seed: number): { city: string; state: string; country: string } {
    return { ...CITIES[seed % CITIES.length], country: "US" };
  }
}
