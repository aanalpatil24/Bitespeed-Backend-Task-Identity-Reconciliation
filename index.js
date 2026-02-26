require('dotenv').config();
const express = require('express');
const { Sequelize, DataTypes, Op } = require('sequelize');

const app = express();
app.use(express.json());

// DB Connection
const sequelize = new Sequelize (
  process.env.DB_NAME, 
  process.env.DB_USER, 
  process.env.DB_PASSWORD,
  {
    host: process.env.DB_HOST, 
    port: process.env.DB_PORT || 5432,
    dialect: 'postgres', logging: false,
    dialectOptions: {
      ssl: {
        require: true,
        rejectUnauthorized: false
      }
    }
  } );

// Table
const Contact = sequelize.define ('Contact', 
  {
    id:{ type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
    phoneNumber: { type: DataTypes.STRING, allowNull: true },
    email: { type: DataTypes.STRING, allowNull: true },
    linkedId: { type: DataTypes.INTEGER, allowNull: true },
    linkPrecedence: { type: DataTypes.ENUM('primary', 'secondary'), 
    allowNull: false, defaultValue: 'primary' },
    createdAt: { type: DataTypes.DATE, allowNull: false, defaultValue: Sequelize.NOW },
    updatedAt: { type: DataTypes.DATE, allowNull: false, defaultValue: Sequelize.NOW },
    deletedAt: { type: DataTypes.DATE, allowNull: true }
  }, 

  { tableName: 'Contact', timestamps: true, paranoid: true} 
);

// Main API Endpoint
app.post('/identify', async (req, res) => {
  try {
    let email = req.body.email || null;
    let phoneNumber = req.body.phoneNumber || null;

    // Convert Phone Number to String if it was sent as a number
    if (phoneNumber && typeof phoneNumber === 'number') {
      phoneNumber = phoneNumber.toString(); 
    }

    if (!email && !phoneNumber) {
      return res.status(400).json({ error: "Please provide email or phone number" }); 
    }
    // Find any existing contacts that match the email or phone
    let matchingContacts = await Contact.findAll({
      where: {
        [Op.or]: [
          { email: email },
          { phoneNumber: phoneNumber }
        ]
      } 
    });

    // Create primary row, return empty secondary array
    if (matchingContacts.length === 0) {
      let newContact = await Contact.create({
        email: email,
        phoneNumber: phoneNumber,
        linkPrecedence: 'primary' });

      return res.status(200).json({
        contact:{
          primaryContactId: newContact.id,
          emails: email ? [email] : [],
          phoneNumbers: phoneNumber ? [phoneNumber] : [],
          secondaryContactIds: [] 
        } 
      });
    }

    //Contacts exist. Find the oldest primary to be the main contact.
    let rootIds = [];
    for (let i = 0; i < matchingContacts.length; i++) {
      let currentMatch = matchingContacts[i];
      let rootId = currentMatch.linkPrecedence === 'primary' 
        ? currentMatch.id 
        : currentMatch.linkedId;
      
      if (!rootIds.includes(rootId)) {
        rootIds.push(rootId); }
    }

    // Fetch the actual primary rows, ordered by oldest first
    let primaryRows = await Contact.findAll({
      where: { id: rootIds },
      order: [['createdAt', 'ASC']]
    });

    // The oldest main contact
    let mainContact = primaryRows[0]; 

    // Primary Contact Can Become Secondary? YES.
    if (primaryRows.length > 1) {
      let newerPrimaryIds = [];
      for (let i = 1; i < primaryRows.length; i++) {
        newerPrimaryIds.push(primaryRows[i].id);
      }

      // Move newer primaries to secondary and link them to the main primary
      await Contact.update(
        { linkPrecedence: 'secondary', linkedId: mainContact.id },
        { where: { id: newerPrimaryIds } }
      );

      // Re-link any primaries to the oldest primary
      await Contact.update(
        { linkedId: mainContact.id },
        { where: { linkedId: newerPrimaryIds } }
      );
    }

    // Get the full updated list of contacts for this person
    let allLinked = await Contact.findAll({
      where: {
        [Op.or]: [
          { id: mainContact.id },
          { linkedId: mainContact.id }
        ]
      },
      order: [['createdAt', 'ASC']]
    });

    // Find what emails and phones we already have in the database
    let knownEmails = [];
    let knownPhones = [];

    for (let i = 0; i < allLinked.length; i++) {
      let c = allLinked[i];
      if (c.email && !knownEmails.includes(c.email)) {
        knownEmails.push(c.email);
      }
      if (c.phoneNumber && !knownPhones.includes(c.phoneNumber)) {
        knownPhones.push(c.phoneNumber);
      }
    }

    // Secondary Contact Creation (if incoming has common info but also contains new info)
    let isNewEmail = email && !knownEmails.includes(email);
    let isNewPhone = phoneNumber && !knownPhones.includes(phoneNumber);

    if (isNewEmail || isNewPhone) {
      let newSecondary = await Contact.create({
        email: email,
        phoneNumber: phoneNumber,
        linkedId: mainContact.id,
        linkPrecedence: 'secondary'
      });
      allLinked.push(newSecondary);
    }

    // Result
    let finalEmails = [];
    let finalPhones = [];
    let secondaryIds = [];

    // First element being email/phoneNumber of primary contact
    if (mainContact.email) {
      finalEmails.push(mainContact.email);
    }
    if (mainContact.phoneNumber) {
      finalPhones.push(mainContact.phoneNumber);
    }

    for (let i = 0; i < allLinked.length; i++) {
      let c = allLinked[i];

      if (c.id === mainContact.id) continue;

      if (c.email && !finalEmails.includes(c.email)) {
        finalEmails.push(c.email);
      }
      if (c.phoneNumber && !finalPhones.includes(c.phoneNumber)) {
        finalPhones.push(c.phoneNumber);
      }
      if (c.linkPrecedence === 'secondary') {
        secondaryIds.push(c.id);
      }
    }

    // Return exact requested result
    return res.status(200).json({
      contact: {
        primaryContactId: mainContact.id,
        emails: finalEmails,
        phoneNumbers: finalPhones,
        secondaryContactIds: secondaryIds
      }
    });

  } 
  
  catch (err) {
    console.log("Error processing request:", err);
    return res.status(500).json({ error: "Internal server error" });
   }
});

// Start Server and Sync DB
sequelize.authenticate().then(() => {
  console.log("Connected to PostgreSQL Database.");
  return sequelize.sync(); 
}).then(() => {
  const PORT = process.env.PORT || 3000;
  app.listen(PORT, () => {
    console.log(`Server is listening on port ${PORT}`);
  });
}).catch(err => {
  console.log("Could not start server:", err);
});
