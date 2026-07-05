// ---------------------------------------------------------------------------
// Test query dataset for retrieval evaluation.
//
// Each object contains:
//   query           — natural language symptom query (as a pet owner might type)
//   relevant_titles — array of vet_kb titles that are ground-truth relevant
//
// Title values MUST match the exact title strings stored in vet_kb.
// ---------------------------------------------------------------------------

var testQueries = [

  // -------------------------------------------------------------------------
  // Category 1: Gastrointestinal symptoms
  // -------------------------------------------------------------------------
  {
    query: 'dog vomiting and diarrhea',
    relevant_titles: ['Gastroenteritis', 'Canine Parvovirus', 'Parvoviral Enteritis (Canine Parvovirus)', 'Pancreatitis']
  },
  {
    query: 'my dog is not eating and keeps vomiting',
    relevant_titles: ['Gastroenteritis', 'Pancreatitis', 'Canine Parvovirus', 'Parvoviral Enteritis (Canine Parvovirus)']
  },
  {
    query: 'puppy has bloody diarrhea and is very weak',
    relevant_titles: ['Canine Parvovirus', 'Parvoviral Enteritis (Canine Parvovirus)', 'Gastroenteritis']
  },
  {
    query: 'dog stomach bloating and not eating',
    relevant_titles: ['Gastroenteritis', 'Pancreatitis']
  },
  {
    query: 'dog throwing up yellow bile in the morning',
    relevant_titles: ['Gastroenteritis', 'Pancreatitis']
  },
  {
    query: 'cat vomiting frequently and losing weight',
    relevant_titles: ['Hyperthyroidism in Cats', 'Gastroenteritis']
  },
  {
    query: 'dog ate something bad and has upset stomach',
    relevant_titles: ['Gastroenteritis', 'Pancreatitis']
  },
  {
    query: 'dog has diarrhea for three days',
    relevant_titles: ['Gastroenteritis', 'Canine Parvovirus', 'Parvoviral Enteritis (Canine Parvovirus)']
  },

  // -------------------------------------------------------------------------
  // Category 2: Musculoskeletal symptoms
  // -------------------------------------------------------------------------
  {
    query: 'dog limping on back leg and having difficulty walking',
    relevant_titles: ['Hip Dysplasia', 'Osteoarthritis (Degenerative Joint Disease)']
  },
  {
    query: 'my dog has joint stiffness especially in the morning',
    relevant_titles: ['Osteoarthritis (Degenerative Joint Disease)', 'Hip Dysplasia']
  },
  {
    query: 'older dog struggles to get up and walk',
    relevant_titles: ['Osteoarthritis (Degenerative Joint Disease)', 'Hip Dysplasia']
  },
  {
    query: 'dog has swollen leg and is in pain',
    relevant_titles: ['Osteoarthritis (Degenerative Joint Disease)', 'Hip Dysplasia', 'Tick-Borne Diseases (Ehrlichiosis / Anaplasmosis)']
  },
  {
    query: 'dog limping front leg and not putting weight on it',
    relevant_titles: ['Osteoarthritis (Degenerative Joint Disease)', 'Hip Dysplasia']
  },
  {
    query: 'puppy walks funny and seems uncomfortable in hips',
    relevant_titles: ['Hip Dysplasia']
  },

  // -------------------------------------------------------------------------
  // Category 3: Skin and eye conditions
  // -------------------------------------------------------------------------
  {
    query: 'dog itching and scratching all the time',
    relevant_titles: ['Skin Allergies (Atopic Dermatitis)', 'Ringworm (Dermatophytosis)', 'Otitis Externa']
  },
  {
    query: 'dog has red irritated eyes with discharge',
    relevant_titles: ['Conjunctivitis']
  },
  {
    query: 'cat has crusty eyes and runny nose',
    relevant_titles: ['Conjunctivitis', 'Feline Upper Respiratory Infection']
  },
  {
    query: 'dog has bald patches and scaly skin',
    relevant_titles: ['Ringworm (Dermatophytosis)', 'Skin Allergies (Atopic Dermatitis)']
  },
  {
    query: 'dog skin rash and hives after being outside',
    relevant_titles: ['Skin Allergies (Atopic Dermatitis)', 'Ringworm (Dermatophytosis)']
  },
  {
    query: 'circular hairless patches on my pet',
    relevant_titles: ['Ringworm (Dermatophytosis)']
  },

  // -------------------------------------------------------------------------
  // Category 4: Respiratory symptoms
  // -------------------------------------------------------------------------
  {
    query: 'dog has persistent cough and runny nose',
    relevant_titles: ['Kennel Cough (Infectious Tracheobronchitis)', 'Heartworm Disease']
  },
  {
    query: 'dog coughing and gagging after playing with other dogs',
    relevant_titles: ['Kennel Cough (Infectious Tracheobronchitis)']
  },
  {
    query: 'cat sneezing a lot and has nasal discharge',
    relevant_titles: ['Feline Upper Respiratory Infection', 'Conjunctivitis']
  },
  {
    query: 'dog has difficulty breathing and rapid breathing rate',
    relevant_titles: ['Heartworm Disease', 'Kennel Cough (Infectious Tracheobronchitis)']
  },
  {
    query: 'dog wheezing and coughing up mucus',
    relevant_titles: ['Kennel Cough (Infectious Tracheobronchitis)', 'Heartworm Disease']
  },

  // -------------------------------------------------------------------------
  // Category 5: Neurological symptoms
  // -------------------------------------------------------------------------
  {
    query: 'dog having seizures and shaking uncontrollably',
    relevant_titles: ['Epilepsy and Seizure Disorders']
  },
  {
    query: 'my dog collapsed and could not stand up',
    relevant_titles: ['Epilepsy and Seizure Disorders', 'Heartworm Disease']
  },
  {
    query: 'dog tilting head to one side and losing balance',
    relevant_titles: ['Otitis Externa', 'Epilepsy and Seizure Disorders']
  },
  {
    query: 'dog tremors and muscle twitching episodes',
    relevant_titles: ['Epilepsy and Seizure Disorders']
  },
  {
    query: 'my dog had a seizure for the first time',
    relevant_titles: ['Epilepsy and Seizure Disorders']
  },

  // -------------------------------------------------------------------------
  // Category 6: Emergency symptoms
  // -------------------------------------------------------------------------
  {
    query: 'my dog is unconscious and not responding',
    relevant_titles: ['Epilepsy and Seizure Disorders', 'Heartworm Disease']
  },
  {
    query: 'dog cannot urinate and is straining in pain',
    relevant_titles: ['Urinary Tract Infection (UTI)', 'Feline Lower Urinary Tract Disease (FLUTD)']
  },
  {
    query: 'cat straining to urinate and crying out in pain',
    relevant_titles: ['Feline Lower Urinary Tract Disease (FLUTD)', 'Urinary Tract Infection (UTI)']
  },
  {
    query: 'dog may have swallowed something toxic or poisonous',
    relevant_titles: ['Gastroenteritis', 'Leptospirosis']
  },
  {
    query: 'dog is drinking excessively and urinating a lot',
    relevant_titles: ['Diabetes Mellitus', 'Urinary Tract Infection (UTI)']
  },
  {
    query: 'dog has blood in urine and frequent urination',
    relevant_titles: ['Urinary Tract Infection (UTI)', 'Feline Lower Urinary Tract Disease (FLUTD)']
  },

  // -------------------------------------------------------------------------
  // Category 7: Breed-specific queries
  // -------------------------------------------------------------------------
  {
    query: 'German Shepherd hip and joint problems',
    relevant_titles: ['Hip Dysplasia', 'Osteoarthritis (Degenerative Joint Disease)']
  },
  {
    query: 'Labrador Retriever overweight and joint pain',
    relevant_titles: ['Osteoarthritis (Degenerative Joint Disease)', 'Hip Dysplasia', 'Diabetes Mellitus']
  },
  {
    query: 'Persian cat eye problems and breathing issues',
    relevant_titles: ['Conjunctivitis', 'Feline Upper Respiratory Infection']
  },
  {
    query: 'Golden Retriever skin allergies and itching',
    relevant_titles: ['Skin Allergies (Atopic Dermatitis)']
  },

  // -------------------------------------------------------------------------
  // Category 8: Informal language queries
  // -------------------------------------------------------------------------
  {
    query: 'my dog is acting weird and not himself today',
    relevant_titles: ['Epilepsy and Seizure Disorders', 'Leptospirosis', 'Diabetes Mellitus']
  },
  {
    query: 'something is wrong with my cat she seems off',
    relevant_titles: ['Hyperthyroidism in Cats', 'Feline Upper Respiratory Infection', 'Feline Lower Urinary Tract Disease (FLUTD)']
  },
  {
    query: 'my dog looks tired all the time and has no energy',
    relevant_titles: ['Heartworm Disease', 'Diabetes Mellitus', 'Tick-Borne Diseases (Ehrlichiosis / Anaplasmosis)']
  },
  {
    query: 'my pet is just lying around and does not want to play',
    relevant_titles: ['Gastroenteritis', 'Canine Parvovirus', 'Leptospirosis']
  },
  {
    query: 'my dog keeps scratching his ears and smells bad',
    relevant_titles: ['Otitis Externa', 'Skin Allergies (Atopic Dermatitis)']
  },

  // -------------------------------------------------------------------------
  // Category 9: Follow-up style queries
  // -------------------------------------------------------------------------
  {
    query: 'is it serious if my dog has been limping for a week',
    relevant_titles: ['Hip Dysplasia', 'Osteoarthritis (Degenerative Joint Disease)']
  },
  {
    query: 'what should I do if my dog is vomiting blood',
    relevant_titles: ['Gastroenteritis', 'Canine Parvovirus', 'Parvoviral Enteritis (Canine Parvovirus)', 'Leptospirosis']
  },
  {
    query: 'how serious is kennel cough and does it go away',
    relevant_titles: ['Kennel Cough (Infectious Tracheobronchitis)']
  },
  {
    query: 'my dog was diagnosed with diabetes what does that mean',
    relevant_titles: ['Diabetes Mellitus']
  },

  // -------------------------------------------------------------------------
  // Category 10: Multi-symptom queries
  // -------------------------------------------------------------------------
  {
    query: 'dog vomiting and lethargic and not eating for two days',
    relevant_titles: ['Gastroenteritis', 'Pancreatitis', 'Canine Parvovirus', 'Parvoviral Enteritis (Canine Parvovirus)', 'Leptospirosis']
  },
  {
    query: 'dog limping and also has a fever and is not eating',
    relevant_titles: ['Tick-Borne Diseases (Ehrlichiosis / Anaplasmosis)', 'Leptospirosis', 'Hip Dysplasia']
  },
  {
    query: 'cat sneezing and has eye discharge and is not eating',
    relevant_titles: ['Feline Upper Respiratory Infection', 'Conjunctivitis']
  },
  {
    query: 'dog scratching ears and shaking head and has yellow discharge',
    relevant_titles: ['Otitis Externa', 'Skin Allergies (Atopic Dermatitis)']
  }

];

module.exports = {
  testQueries: testQueries
};
