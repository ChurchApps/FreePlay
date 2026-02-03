import { View, Text, ScrollView } from 'react-native'
import React from 'react'
import { MenuHeader } from '../components'
import { Styles } from '../helpers'

type Props = { navigateTo(page: string, data?:any): void; };
const PrivacyPolicyScreen = (props : Props) => {

  return(
    <View style={{flex:1}}>
      <MenuHeader headerText="Privacy Policy" showBackbutton={true} onpress={()=>props.navigateTo("settings")}/>
      <ScrollView style={{flex: 1, padding: 20}}>
        <Text style={[Styles.whiteText, {textAlign: 'left', marginBottom: 20}]}>
          To view our full privacy policy, please visit:
        </Text>
        <Text style={[Styles.H2, {textAlign: 'left'}]}>
          churchapps.org/privacy
        </Text>
      </ScrollView>
    </View>
    )
}

export default PrivacyPolicyScreen