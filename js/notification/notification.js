/*  _-_      _-_      _-__-_   _-__-__-__-__-__-__-__-_
    _-_      _-_      _-__-_   _-__-_      _-__-_
    _-_      _-_      _-__-__-_   _-_      _-__-_
    _-_      _-_      _-__-__-_   _-__-__-__-__-__-__-_
    _-__-__-__-__-__-__-__-_   _-__-_      _-_      _-_
    _-__-__-__-__-__-__-__-_   _-__-_      _-__-__-__-_
    ***************************************************
    ***************************************************
    This content is coded by Lukas Häring García and the
    idea is taken from some other hacking programs.
*/
const NotificationType = {
  NONE: 0,
  ERROR: 1,
  SUCCESS: 2,
  NOTIFICATION: 3,
};

class Notification{
  constructor(_title, _description, _type = NotificationType.NONE){
    // TODO: WIKI INFORMATION.
    this.id = Utils.uid();

    // Basic Information
    this.title = _title;
    this.description = _description;
    this.type = _type;

    // Date emitted.
    this.date = new Date();
  };

  /*
    Description: Returns date of the update.
    Returns: Date Object.
  */
  getDate(){ return this.date; };

  /*
    Description: Returns UID of the notifiaction.
    Returns: String Object.
  */
  getId(){ return this.id; };

  /*
    Description: Returns HTML Format
    Returns: String Object
  */
  getHTML(){
    let minutes = Utils.pad(this.date.getMinutes().toString(), '0', 2);
    let hours = Utils.pad(this.date.getHours().toString(), '0', 2);

    // Find out the name of the type.
    let notification_name = "NONE";
    for(let notification in NotificationType){
      if(NotificationType[notification] == this.type){
        notification_name = notification;
      }
    }

    let html =
    `<div class="notification notification--${ notification_name }" data-uid="${ this.id }">
      <div class="notifiaction-close">&#10005;</div>
      <div class="notification-info">
        <h6>${ this.title }</h6>
        <p>${ this.description }</p>
        <div class="notifiaction-footer">
          <a href="#" class="notifiaction-hlink">+ Read more</a>
          <div class="notification-date">${ hours }:${ minutes }</div>
        </div>
      </div>
    </div>`;

    return html;
  };
};
