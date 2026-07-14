// ---------------------------------------------------------------------------
// Test query dataset for retrieval evaluation.
//
// Each object contains:
//   query           — natural language symptom query (as a pet owner might type)
//   relevant_titles — array of vet_kb titles that are ground-truth relevant
//
// Title values MUST match the exact title strings stored in vet_kb.
// Generated from the current vet_kb_data.json (168 entries, breed-specific
// condition and general health profile entries).
// ---------------------------------------------------------------------------

var testQueries = [

  // -------------------------------------------------------------------------
  // Category 1: Brachycephalic Airway Syndrome
  // Breeds: Bulldog, French Bulldog, Pug
  // -------------------------------------------------------------------------
  {
    query: 'my bulldog has trouble breathing and snores very loudly',
    relevant_titles: [
      'Bulldog - Brachycephalic Airway Syndrome',
      'Bulldogs - Brachycephalic Airway Syndrome',
      '"Bulldog" - Brachycephalic Airway Syndrome'
    ]
  },
  {
    query: 'bulldog making honking sound and struggling to breathe through nose',
    relevant_titles: [
      'Bulldog - Brachycephalic Airway Syndrome',
      'Bulldogs - Brachycephalic Airway Syndrome',
      '"Bulldog" - Brachycephalic Airway Syndrome'
    ]
  },
  {
    query: 'French Bulldog breathing problems and overheating easily',
    relevant_titles: [
      'French Bulldogs - Brachycephalic Airway Syndrome',
      'French - Brachycephalic Airway Syndrome and Skin Fold Dermatitis',
      'Bulldog - Brachycephalic Airway Syndrome'
    ]
  },
  {
    query: 'French Bulldog skin fold infections and noisy breathing',
    relevant_titles: [
      'French - Brachycephalic Airway Syndrome and Skin Fold Dermatitis',
      'French Bulldogs - Brachycephalic Airway Syndrome'
    ]
  },
  {
    query: 'pug gasping and having difficulty breathing during exercise',
    relevant_titles: [
      'Pug - Brachycephalic Airway Syndrome and Corneal Ulcers',
      'Bulldog - Brachycephalic Airway Syndrome',
      'Bulldogs - Brachycephalic Airway Syndrome'
    ]
  },
  {
    query: 'flat-faced dog snoring and reverse sneezing constantly',
    relevant_titles: [
      'Bulldog - Brachycephalic Airway Syndrome',
      'Bulldogs - Brachycephalic Airway Syndrome',
      'French Bulldogs - Brachycephalic Airway Syndrome',
      'Pug - Brachycephalic Airway Syndrome and Corneal Ulcers'
    ]
  },
  {
    query: 'dog with short flat snout has noisy laboured breathing',
    relevant_titles: [
      'Bulldog - Brachycephalic Airway Syndrome',
      'Bulldogs - Brachycephalic Airway Syndrome',
      'Pug - Brachycephalic Airway Syndrome and Corneal Ulcers',
      'French Bulldogs - Brachycephalic Airway Syndrome'
    ]
  },

  // -------------------------------------------------------------------------
  // Category 2: Hip Dysplasia and Degenerative Joint Problems
  // Breeds: German Shepherd, Labrador Retriever
  // -------------------------------------------------------------------------
  {
    query: 'German Shepherd limping and having trouble with back legs',
    relevant_titles: [
      'German Shepherd - Hip Dysplasia and Degenerative Myelopathy'
    ]
  },
  {
    query: 'German Shepherd hind leg weakness and dragging feet',
    relevant_titles: [
      'German Shepherd - Hip Dysplasia and Degenerative Myelopathy'
    ]
  },
  {
    query: 'Labrador Retriever hip problems and struggling to walk up stairs',
    relevant_titles: [
      'Labrador Retriever - Hip Dysplasia and Obesity',
      'Labrador Retrievers - Hip Dysplasia and Obesity',
      'Labrador - Hip Dysplasia and Obesity'
    ]
  },
  {
    query: 'Labrador overweight and has difficulty getting up from floor',
    relevant_titles: [
      'Labrador Retriever - Hip Dysplasia and Obesity',
      'Labrador Retrievers - Hip Dysplasia and Obesity',
      'Labrador - Hip Dysplasia and Obesity'
    ]
  },
  {
    query: 'large dog breed limping on back leg and cannot stand properly',
    relevant_titles: [
      'German Shepherd - Hip Dysplasia and Degenerative Myelopathy',
      'Labrador Retriever - Hip Dysplasia and Obesity',
      'Labrador Retrievers - Hip Dysplasia and Obesity'
    ]
  },
  {
    query: 'my dog hind legs are progressively getting weaker over months',
    relevant_titles: [
      'German Shepherd - Hip Dysplasia and Degenerative Myelopathy',
      'Labrador Retriever - Hip Dysplasia and Obesity',
      'Labrador Retrievers - Hip Dysplasia and Obesity'
    ]
  },
  {
    query: 'dog joint pain and stiffness in hips especially in the morning',
    relevant_titles: [
      'German Shepherd - Hip Dysplasia and Degenerative Myelopathy',
      'Labrador Retriever - Hip Dysplasia and Obesity',
      'Labrador - Hip Dysplasia and Obesity'
    ]
  },

  // -------------------------------------------------------------------------
  // Category 3: Intervertebral Disc Disease (IVDD)
  // Breeds: Dachshund
  // -------------------------------------------------------------------------
  {
    query: 'Dachshund back pain and cannot move hind legs suddenly',
    relevant_titles: [
      'Dachshund - Intervertebral Disc Disease (IVDD)',
      'Dachshunds - Intervertebral Disc Disease (IVDD)'
    ]
  },
  {
    query: 'Dachshund screaming in pain when being picked up',
    relevant_titles: [
      'Dachshund - Intervertebral Disc Disease (IVDD)',
      'Dachshunds - Intervertebral Disc Disease (IVDD)'
    ]
  },
  {
    query: 'my sausage dog cannot use its back legs and is paralyzed',
    relevant_titles: [
      'Dachshund - Intervertebral Disc Disease (IVDD)',
      'Dachshunds - Intervertebral Disc Disease (IVDD)'
    ]
  },
  {
    query: 'long-bodied dog spine disc problems and wobbly walking',
    relevant_titles: [
      'Dachshund - Intervertebral Disc Disease (IVDD)',
      'Dachshunds - Intervertebral Disc Disease (IVDD)'
    ]
  },
  {
    query: 'dog back injury and intervertebral disc herniation symptoms',
    relevant_titles: [
      'Dachshund - Intervertebral Disc Disease (IVDD)',
      'Dachshunds - Intervertebral Disc Disease (IVDD)'
    ]
  },

  // -------------------------------------------------------------------------
  // Category 4: Progressive Retinal Atrophy (PRA) and Vision Loss
  // Breeds: Poodle
  // -------------------------------------------------------------------------
  {
    query: 'Poodle going blind slowly and bumping into furniture at night',
    relevant_titles: [
      'Poodle - Progressive Retinal Atrophy (PRA)',
      'Poodles - Progressive Retinal Atrophy (PRA)'
    ]
  },
  {
    query: 'dog night blindness and struggling to see in dim light',
    relevant_titles: [
      'Poodle - Progressive Retinal Atrophy (PRA)',
      'Poodles - Progressive Retinal Atrophy (PRA)',
      'Siberian Husky - Cataracts and Hypothyroidism'
    ]
  },
  {
    query: 'Poodle vision getting worse over time inherited eye disease',
    relevant_titles: [
      'Poodle - Progressive Retinal Atrophy (PRA)',
      'Poodles - Progressive Retinal Atrophy (PRA)'
    ]
  },
  {
    query: 'dog retinal degeneration and progressive vision loss',
    relevant_titles: [
      'Poodle - Progressive Retinal Atrophy (PRA)',
      'Poodles - Progressive Retinal Atrophy (PRA)'
    ]
  },

  // -------------------------------------------------------------------------
  // Category 5: Cataracts and Hypothyroidism
  // Breeds: Siberian Husky
  // -------------------------------------------------------------------------
  {
    query: 'Siberian Husky has cloudy eyes and seems to have vision problems',
    relevant_titles: [
      'Siberian Husky - Cataracts and Hypothyroidism'
    ]
  },
  {
    query: 'Husky gaining weight for no reason and is always tired',
    relevant_titles: [
      'Siberian Husky - Cataracts and Hypothyroidism'
    ]
  },
  {
    query: 'dog cataracts and hypothyroid weight gain lethargy',
    relevant_titles: [
      'Siberian Husky - Cataracts and Hypothyroidism'
    ]
  },

  // -------------------------------------------------------------------------
  // Category 6: Corneal Ulcers and Dental Disease
  // Breeds: Shih Tzu, Pug
  // -------------------------------------------------------------------------
  {
    query: 'Shih Tzu has a red painful eye and is squinting constantly',
    relevant_titles: [
      'Shih Tzu - Corneal Ulcers and Dental Disease',
      'Pug - Brachycephalic Airway Syndrome and Corneal Ulcers'
    ]
  },
  {
    query: 'dog eye ulcer and cloudy spot on the cornea',
    relevant_titles: [
      'Shih Tzu - Corneal Ulcers and Dental Disease',
      'Pug - Brachycephalic Airway Syndrome and Corneal Ulcers'
    ]
  },
  {
    query: 'Pug eye popping out and corneal problem',
    relevant_titles: [
      'Pug - Brachycephalic Airway Syndrome and Corneal Ulcers'
    ]
  },
  {
    query: 'Shih Tzu bad teeth and dental disease with eye discharge',
    relevant_titles: [
      'Shih Tzu - Corneal Ulcers and Dental Disease'
    ]
  },

  // -------------------------------------------------------------------------
  // Category 7: Cancer and Tumors
  // Breeds: Golden Retriever, Rottweiler, Boxer
  // -------------------------------------------------------------------------
  {
    query: 'Golden Retriever has a lump and is losing a lot of weight',
    relevant_titles: [
      'Golden Retriever - Lymphoma and Haemangiosarcoma (Cancer)'
    ]
  },
  {
    query: 'Golden Retriever swollen lymph nodes and very lethargic',
    relevant_titles: [
      'Golden Retriever - Lymphoma and Haemangiosarcoma (Cancer)'
    ]
  },
  {
    query: 'dog internal bleeding and sudden collapse cancer symptoms',
    relevant_titles: [
      'Golden Retriever - Lymphoma and Haemangiosarcoma (Cancer)',
      'Rottweiler - Osteosarcoma (Bone Cancer)',
      'Boxer - Mast Cell Tumors and Cardiomyopathy'
    ]
  },
  {
    query: 'Rottweiler limping with swollen painful leg bone',
    relevant_titles: [
      'Rottweiler - Osteosarcoma (Bone Cancer)'
    ]
  },
  {
    query: 'large breed dog bone cancer and lameness getting worse',
    relevant_titles: [
      'Rottweiler - Osteosarcoma (Bone Cancer)'
    ]
  },
  {
    query: 'Boxer dog has a skin lump and heart rhythm problems',
    relevant_titles: [
      'Boxer - Mast Cell Tumors and Cardiomyopathy'
    ]
  },
  {
    query: 'Boxer skin bumps and mast cell tumor signs',
    relevant_titles: [
      'Boxer - Mast Cell Tumors and Cardiomyopathy'
    ]
  },

  // -------------------------------------------------------------------------
  // Category 8: Gastric Dilatation-Volvulus (GDV / Bloat)
  // Breeds: Great Dane
  // -------------------------------------------------------------------------
  {
    query: 'Great Dane stomach bloating and retching without bringing anything up',
    relevant_titles: [
      'Great Dane - Gastric Dilatation-Volvulus (Bloat)',
      'Great Danes - Gastric Dilatation-Volvulus (Bloat)'
    ]
  },
  {
    query: 'large breed dog stomach distended and in severe pain after eating',
    relevant_titles: [
      'Great Dane - Gastric Dilatation-Volvulus (Bloat)',
      'Great Danes - Gastric Dilatation-Volvulus (Bloat)'
    ]
  },
  {
    query: 'dog bloat emergency stomach twisted signs',
    relevant_titles: [
      'Great Dane - Gastric Dilatation-Volvulus (Bloat)',
      'Great Danes - Gastric Dilatation-Volvulus (Bloat)'
    ]
  },
  {
    query: 'Great Dane restless after eating and cannot lie down',
    relevant_titles: [
      'Great Dane - Gastric Dilatation-Volvulus (Bloat)',
      'Great Danes - Gastric Dilatation-Volvulus (Bloat)'
    ]
  },

  // -------------------------------------------------------------------------
  // Category 9: Mitral Valve Disease (MVD) and Heart Problems
  // Breeds: Cavalier King Charles Spaniel, Boxer
  // -------------------------------------------------------------------------
  {
    query: 'Cavalier King Charles Spaniel heart murmur and coughing at night',
    relevant_titles: [
      'Cavalier King Charles Spaniel - Mitral Valve Disease (MVD)'
    ]
  },
  {
    query: 'Cavalier King Charles Spaniel exercise intolerance and breathlessness',
    relevant_titles: [
      'Cavalier King Charles Spaniel - Mitral Valve Disease (MVD)'
    ]
  },
  {
    query: 'small dog breed with heart valve disease and fluid in lungs',
    relevant_titles: [
      'Cavalier King Charles Spaniel - Mitral Valve Disease (MVD)'
    ]
  },
  {
    query: 'dog heart disease coughing and difficulty breathing when resting',
    relevant_titles: [
      'Cavalier King Charles Spaniel - Mitral Valve Disease (MVD)',
      'Boxer - Mast Cell Tumors and Cardiomyopathy'
    ]
  },

  // -------------------------------------------------------------------------
  // Category 10: Obesity and Epilepsy
  // Breeds: Beagle, Labrador
  // -------------------------------------------------------------------------
  {
    query: 'Beagle keeps gaining weight even on a controlled diet',
    relevant_titles: [
      'Beagle - Obesity and Epilepsy'
    ]
  },
  {
    query: 'Beagle having seizures and epilepsy episodes',
    relevant_titles: [
      'Beagle - Obesity and Epilepsy'
    ]
  },
  {
    query: 'Beagle overweight and also has unexplained fits or tremors',
    relevant_titles: [
      'Beagle - Obesity and Epilepsy'
    ]
  },
  {
    query: 'Labrador always hungry and getting obese',
    relevant_titles: [
      'Labrador Retriever - Hip Dysplasia and Obesity',
      'Labrador Retrievers - Hip Dysplasia and Obesity',
      'Labrador - Hip Dysplasia and Obesity',
      'Beagle - Obesity and Epilepsy'
    ]
  },

  // -------------------------------------------------------------------------
  // Category 11: Collapsing Trachea and Dental Disease
  // Breeds: Yorkshire Terrier
  // -------------------------------------------------------------------------
  {
    query: 'Yorkshire Terrier making a goose honking cough sound',
    relevant_titles: [
      'Yorkshire Terrier - Collapsing Trachea and Dental Disease'
    ]
  },
  {
    query: 'small dog trachea collapse and coughing when excited',
    relevant_titles: [
      'Yorkshire Terrier - Collapsing Trachea and Dental Disease'
    ]
  },
  {
    query: 'Yorkshire Terrier bad breath rotten teeth and dental pain',
    relevant_titles: [
      'Yorkshire Terrier - Collapsing Trachea and Dental Disease',
      'Shih Tzu - Corneal Ulcers and Dental Disease'
    ]
  },
  {
    query: 'small breed dog dental disease and chronic cough',
    relevant_titles: [
      'Yorkshire Terrier - Collapsing Trachea and Dental Disease',
      'Shih Tzu - Corneal Ulcers and Dental Disease'
    ]
  },

  // -------------------------------------------------------------------------
  // Category 12: Breed-specific health queries (general)
  // -------------------------------------------------------------------------
  {
    query: 'German Shepherd breed common health problems and conditions',
    relevant_titles: [
      'German Shepherd - Hip Dysplasia and Degenerative Myelopathy'
    ]
  },
  {
    query: 'Golden Retriever most common diseases to watch out for',
    relevant_titles: [
      'Golden Retriever - Lymphoma and Haemangiosarcoma (Cancer)'
    ]
  },
  {
    query: 'Dachshund breed specific health issues owner should know',
    relevant_titles: [
      'Dachshund - Intervertebral Disc Disease (IVDD)',
      'Dachshunds - Intervertebral Disc Disease (IVDD)'
    ]
  },
  {
    query: 'Poodle inherited health conditions and genetic diseases',
    relevant_titles: [
      'Poodle - Progressive Retinal Atrophy (PRA)',
      'Poodles - Progressive Retinal Atrophy (PRA)'
    ]
  },
  {
    query: 'Great Dane owner guide to common health emergencies',
    relevant_titles: [
      'Great Dane - Gastric Dilatation-Volvulus (Bloat)',
      'Great Danes - Gastric Dilatation-Volvulus (Bloat)'
    ]
  },
  {
    query: 'Rottweiler serious health risks and bone problems',
    relevant_titles: [
      'Rottweiler - Osteosarcoma (Bone Cancer)'
    ]
  },
  {
    query: 'Pug health conditions and eye and breathing issues',
    relevant_titles: [
      'Pug - Brachycephalic Airway Syndrome and Corneal Ulcers'
    ]
  },
  {
    query: 'Siberian Husky common health concerns for new owners',
    relevant_titles: [
      'Siberian Husky - Cataracts and Hypothyroidism'
    ]
  },
  {
    query: 'Cavalier King Charles Spaniel breed known medical problems',
    relevant_titles: [
      'Cavalier King Charles Spaniel - Mitral Valve Disease (MVD)'
    ]
  },
  {
    query: 'Boxer dog frequent health issues mast cell and heart',
    relevant_titles: [
      'Boxer - Mast Cell Tumors and Cardiomyopathy'
    ]
  },
  {
    query: 'Labrador Retriever weight management and joint health',
    relevant_titles: [
      'Labrador Retriever - Hip Dysplasia and Obesity',
      'Labrador Retrievers - Hip Dysplasia and Obesity',
      'Labrador - Hip Dysplasia and Obesity'
    ]
  },
  {
    query: 'Shih Tzu eye conditions and dental care guide',
    relevant_titles: [
      'Shih Tzu - Corneal Ulcers and Dental Disease'
    ]
  }

];

module.exports = {
  testQueries: testQueries
};
